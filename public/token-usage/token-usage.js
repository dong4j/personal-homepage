/**
 * Static TokenTracker usage dashboard.
 *
 * This file intentionally depends only on a public snapshot JSON. The original
 * TokenTracker dashboard reads local APIs and auth state; for a static blog we
 * keep the same usage-page information architecture while avoiding any runtime
 * dependency on the visitor's localhost.
 */
(function () {
  const PERIOD_LABELS = {
    day: "日",
    week: "周",
    month: "月",
    total: "总计",
  };
  const SOURCE_COLORS = ["#8b5cf6", "#10b981", "#315adf", "#f59e0b", "#ef4444"];
  const state = {
    snapshot: null,
    period: "month",
  };

  const els = {
    shell: document.querySelector(".tt-shell"),
    error: document.getElementById("tt-error"),
    updatedAt: document.getElementById("tt-updated-at"),
    tabs: document.getElementById("tt-tabs"),
    total: document.getElementById("tt-total"),
    cost: document.getElementById("tt-cost"),
    last7: document.getElementById("tt-last7"),
    last30: document.getElementById("tt-last30"),
    average: document.getElementById("tt-average"),
    convs: document.getElementById("tt-convs"),
    started: document.getElementById("tt-started"),
    activeDays: document.getElementById("tt-active-days"),
    topModels: document.getElementById("tt-top-models"),
    heatmap: document.getElementById("tt-heatmap"),
    timezone: document.getElementById("tt-timezone"),
    trend: document.getElementById("tt-trend"),
    trendFrom: document.getElementById("tt-trend-from"),
    trendTo: document.getElementById("tt-trend-to"),
    sourceBar: document.getElementById("tt-source-bar"),
    sourceGrid: document.getElementById("tt-source-grid"),
    dailyRows: document.getElementById("tt-daily-rows"),
    share: document.getElementById("tt-share"),
    refresh: document.getElementById("tt-refresh"),
  };
  let heatmapTooltip = null;

  init();

  async function init() {
    try {
      const snapshotUrl = withSnapshotRequestParam(resolveSnapshotUrl());
      const snapshot = await loadSnapshot(snapshotUrl);
      state.snapshot = snapshot;
      renderStatic(snapshot);
      bindTabs();
      bindActions();
      renderPeriod();
      els.shell.dataset.state = "ready";
    } catch (error) {
      console.error("[token-usage] failed to load snapshot", error);
      els.shell.dataset.state = "error";
      els.error.hidden = false;
      if (els.updatedAt) els.updatedAt.textContent = "快照不可用";
    }
  }

  function resolveSnapshotUrl() {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get("data");
    if (fromQuery) return fromQuery;
    return window.TOKEN_USAGE_SNAPSHOT_URL || "./usage-snapshot.json";
  }

  function withSnapshotRequestParam(value) {
    try {
      const url = new URL(value, window.location.href);
      // CDN may cache a no-Origin variant without CORS headers when the raw JSON
      // URL is opened directly. A daily query key keeps the public snapshot
      // cacheable while forcing the fetch path onto a CORS-aware cache variant.
      if (!url.searchParams.has("tt_snapshot")) {
        url.searchParams.set("tt_snapshot", new Date().toISOString().slice(0, 10));
      }
      return url.toString();
    } catch (_error) {
      return value;
    }
  }

  async function loadSnapshot(snapshotUrl) {
    try {
      const res = await fetch(snapshotUrl, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (error) {
      console.warn("[token-usage] JSON fetch failed, trying script fallback", error);
      return await loadSnapshotScript(toSnapshotScriptUrl(snapshotUrl));
    }
  }

  function toSnapshotScriptUrl(snapshotUrl) {
    const url = new URL(snapshotUrl, window.location.href);
    url.pathname = url.pathname.replace(/\.json$/, ".js");
    return url.toString();
  }

  function loadSnapshotScript(scriptUrl) {
    return new Promise((resolve, reject) => {
      const previous = window.TOKEN_USAGE_SNAPSHOT;
      const script = document.createElement("script");
      script.src = scriptUrl;
      script.async = true;
      script.onload = () => {
        script.remove();
        const snapshot = window.TOKEN_USAGE_SNAPSHOT;
        if (snapshot && typeof snapshot === "object") {
          resolve(snapshot);
          return;
        }
        window.TOKEN_USAGE_SNAPSHOT = previous;
        reject(new Error("Script fallback did not provide TOKEN_USAGE_SNAPSHOT"));
      };
      script.onerror = () => {
        script.remove();
        window.TOKEN_USAGE_SNAPSHOT = previous;
        reject(new Error(`Script fallback failed: ${scriptUrl}`));
      };
      document.head.appendChild(script);
    });
  }

  function bindTabs() {
    els.tabs.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-period]");
      if (!button || button.disabled) return;
      state.period = button.dataset.period;
      for (const item of els.tabs.querySelectorAll("button")) {
        item.classList.toggle("is-active", item === button);
        item.setAttribute("aria-selected", item === button ? "true" : "false");
      }
      renderPeriod();
    });
  }

  function bindActions() {
    els.refresh?.addEventListener("click", () => window.location.reload());
    els.share?.addEventListener("click", async () => {
      const url = window.location.href;
      try {
        await navigator.clipboard.writeText(url);
        const previous = els.share.textContent;
        els.share.textContent = "已复制";
        window.setTimeout(() => {
          els.share.textContent = previous;
        }, 1200);
      } catch (_error) {
        window.prompt("复制统计页面链接", url);
      }
    });
  }

  function renderStatic(snapshot) {
    els.updatedAt.textContent = `更新于 ${formatDateTime(snapshot.generatedAt)}`;
    els.timezone.textContent = formatTimeZone(snapshot.timeZone);
    els.started.textContent = snapshot.range?.startedAt || "-";
    els.activeDays.textContent = formatInteger(snapshot.periods?.total?.activeDays || 0);
    els.last7.textContent = formatCompact(snapshot.periods?.week?.totals?.totalTokens || 0);
    els.last30.textContent = formatCompact(snapshot.periods?.month?.totals?.totalTokens || 0);
    const month = snapshot.periods?.month;
    const avg = month?.activeDays
      ? Math.round((month.totals?.totalTokens || 0) / month.activeDays)
      : 0;
    els.average.textContent = formatCompact(avg);
    els.convs.textContent = formatCompact(month?.totals?.conversationCount || 0);
    renderHeatmap(snapshot.heatmap);
    renderTrend(snapshot.trend || []);
  }

  function renderPeriod() {
    const period = state.snapshot?.periods?.[state.period] || state.snapshot?.periods?.month;
    if (!period) return;
    els.total.textContent = formatInteger(period.totals?.totalTokens || 0);
    els.cost.textContent = formatUsd(period.totals?.costUsd || 0);
    renderTopModels(period.topModels || []);
    renderSources(period.sources || []);
    renderDailyRows(period.daily || []);
      document.title = `Token 统计 · ${PERIOD_LABELS[state.period] || "月"}`;
  }

  function renderTopModels(models) {
    els.topModels.innerHTML = "";
    const total = models.reduce((sum, item) => sum + number(item.totalTokens), 0);
    for (const [index, model] of models.slice(0, 3).entries()) {
      const row = document.createElement("div");
      row.className = "tt-model-row";
      const share = total > 0 ? (number(model.totalTokens) / total) * 100 : 0;
      row.innerHTML = `
        <span class="tt-model-rank">${index + 1}</span>
        <span title="${escapeHtml(model.name || model.id)}">${escapeHtml(model.name || model.id)}</span>
        <strong>${share.toFixed(1)}%</strong>
      `;
      els.topModels.appendChild(row);
    }
  }

  function renderSources(sources) {
    const total = sources.reduce((sum, item) => sum + number(item.totalTokens), 0);
    els.sourceBar.innerHTML = "";
    els.sourceGrid.innerHTML = "";
    for (const [index, source] of sources.slice(0, 5).entries()) {
      const color = SOURCE_COLORS[index % SOURCE_COLORS.length];
      const share = total > 0 ? (number(source.totalTokens) / total) * 100 : 0;
      const bar = document.createElement("span");
      bar.style.width = `${Math.max(share, 0.5)}%`;
      bar.style.background = color;
      els.sourceBar.appendChild(bar);

      const card = document.createElement("article");
      card.className = "tt-source-card";
      card.innerHTML = `
        <span class="tt-source-name"><i style="color:${color}">${escapeHtml(source.name[0] || "?")}</i>${escapeHtml(source.name)}</span>
        <strong class="tt-source-share">${share.toFixed(1)}%</strong>
        <span class="tt-source-models">${formatInteger(source.modelCount || 0)} 个模型</span>
      `;
      els.sourceGrid.appendChild(card);
    }
  }

  function renderDailyRows(rows) {
    els.dailyRows.innerHTML = "";
    const ordered = rows.slice().reverse().filter((row) => number(row.totalTokens) > 0);
    for (const row of ordered.slice(0, 14)) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(row.day)}</td>
        <td>${formatInteger(row.totalTokens)}</td>
        <td>${formatInteger(row.inputTokens)}</td>
        <td>${formatInteger(row.outputTokens)}</td>
        <td>${formatInteger(row.cachedInputTokens)}</td>
        <td>${formatInteger(row.reasoningOutputTokens)}</td>
        <td>${formatInteger(row.conversationCount)}</td>
      `;
      els.dailyRows.appendChild(tr);
    }
  }

  function renderHeatmap(heatmap) {
    if (!heatmap?.weeks) return;
    const grid = document.createElement("div");
    grid.className = "tt-heatmap-grid";
    for (const week of heatmap.weeks) {
      for (const cell of week) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `tt-cell tt-level-${cell.level || 0}`;
        button.title = `${cell.day}: ${formatInteger(cell.totalTokens || 0)} tokens`;
        button.addEventListener("mouseenter", () => showHeatmapTooltip(button, cell));
        button.addEventListener("focus", () => showHeatmapTooltip(button, cell));
        button.addEventListener("mouseleave", hideHeatmapTooltip);
        button.addEventListener("blur", hideHeatmapTooltip);
        grid.appendChild(button);
      }
    }
    els.heatmap.replaceChildren(grid);
  }

  function showHeatmapTooltip(anchor, cell) {
    if (!cell?.day) return;
    if (!heatmapTooltip) {
      heatmapTooltip = document.createElement("div");
      heatmapTooltip.className = "tt-heatmap-tooltip";
      els.shell.appendChild(heatmapTooltip);
    }
    const total = number(cell.totalTokens || cell.billableTokens);
    const models = Array.isArray(cell.models) ? cell.models.slice(0, 5) : [];
    heatmapTooltip.innerHTML = `
      <div class="tt-tooltip-head">
        <strong>${escapeHtml(cell.day)}</strong>
        <span>Level ${number(cell.level).toFixed(0)}</span>
      </div>
      <div class="tt-tooltip-total">${formatInteger(total)} <span>tokens</span></div>
      ${
        models.length > 0
          ? `<div class="tt-tooltip-models">
              <p>MODEL BREAKDOWN</p>
              ${models
                .map((model) => {
                  const share = total > 0 ? (number(model.totalTokens) / total) * 100 : 0;
                  return `
                    <div class="tt-tooltip-model">
                      <div>
                        <span>${escapeHtml(model.name || model.id)}</span>
                        <strong>${formatInteger(model.totalTokens)}</strong>
                        <em>${share.toFixed(0)}%</em>
                      </div>
                      <i style="width:${Math.max(2, Math.min(100, share))}%"></i>
                    </div>
                  `;
                })
                .join("")}
            </div>`
          : ""
      }
    `;
    heatmapTooltip.hidden = false;
    const rect = anchor.getBoundingClientRect();
    const shellRect = els.shell.getBoundingClientRect();
    const tooltipRect = heatmapTooltip.getBoundingClientRect();
    const left = Math.min(
      shellRect.width - tooltipRect.width - 12,
      Math.max(12, rect.left - shellRect.left + rect.width / 2 - tooltipRect.width / 2),
    );
    const top = Math.max(12, rect.top - shellRect.top - tooltipRect.height - 14);
    heatmapTooltip.style.left = `${left}px`;
    heatmapTooltip.style.top = `${top}px`;
  }

  function hideHeatmapTooltip() {
    if (heatmapTooltip) heatmapTooltip.hidden = true;
  }

  function renderTrend(rows) {
    const max = Math.max(1, ...rows.map((row) => number(row.totalTokens)));
    els.trend.innerHTML = "";
    for (const row of rows) {
      const bar = document.createElement("span");
      bar.className = "tt-bar";
      bar.style.height = `${Math.max(2, (number(row.totalTokens) / max) * 100)}%`;
      bar.title = `${row.day}: ${formatInteger(row.totalTokens)} tokens`;
      els.trend.appendChild(bar);
    }
    els.trendFrom.textContent = rows[0]?.day || "-";
    els.trendTo.textContent = rows[rows.length - 1]?.day || "-";
  }

  function formatDateTime(value) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return "-";
    return new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
  }

  function formatTimeZone(value) {
    if (value === "Asia/Shanghai") return "UTC+08:00";
    return value || "UTC+08:00";
  }

  function formatInteger(value) {
    return Math.round(number(value)).toLocaleString("en-US");
  }

  function formatCompact(value) {
    const n = number(value);
    if (n >= 1_000_000_000) return `${trim(n / 1_000_000_000)}B`;
    if (n >= 1_000_000) return `${trim(n / 1_000_000)}M`;
    if (n >= 1_000) return `${trim(n / 1_000)}K`;
    return formatInteger(n);
  }

  function formatUsd(value) {
    return `$${number(value).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  function trim(value) {
    return value.toFixed(1).replace(/\.0$/, "");
  }

  function number(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      }[char];
    });
  }
})();
