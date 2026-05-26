# AGENTS.md

本文件为 `dependencies/personal-page` 项目提供 Codex AI 助手的指导规范。

---

## 项目概述

**项目性质**：基于 Bun + TypeScript 的个人主页 (fork 自 [platane.github.io](https://github.com/Platane/Platane.github.io))

**用途**：个人首页展示，包含 3D 动画背景和社交链接

**技术栈**：
- Bun (运行时 + 打包工具)
- TypeScript
- WebGL (via jurassic-nursery)
- gl-matrix (3D 数学库)
- 原生 HTML/CSS (无框架)

**Node 版本**：`.nvmrc` 指定为 `21`

---

## 项目结构

```
personal-page/
├── src/
│   ├── index.html     # HTML 页面 (含内联 CSS)
│   └── index.ts       # TypeScript 入口 (WebGL 3D 场景)
├── scripts/
│   ├── build.ts       # 构建入口
│   ├── builder.ts     # 构建逻辑 (Bun.build)
│   └── dev.ts         # 开发服务器
├── public/            # 静态资源 (头像等)
├── dist/              # 构建输出目录
└── types.d.ts         # TypeScript 类型定义
```

---

## 开发规范

### 常用命令

```bash
cd dependencies/personal-page

# 安装依赖
bun install

# 下载 3D 模型资源 (首次运行必须)
bun build:model

# 开发模式 (热重载)
bun dev

# 构建生产版本
bun run build

# 构建产物在 dist/ 目录
```

### 构建流程

1. `bun build:model` - 下载 3D 几何模型到 `node_modules/jurassic-nursery/packages/game/assets/geometry.bin`
2. `bun build` - 使用 Bun.build 打包 TypeScript，输出到 `dist/`
3. 复制 `src/index.html` 到 dist/
4. 递归复制 `public/` 到 `dist/`

### 代码风格

- TypeScript strict 模式
- 使用 ES2022 模块
- 无格式化工具配置 (可手动格式化)

---

## 核心功能

### 3D 背景场景

`src/index.ts` 加载 WebGL 3D 场景：
- 一群可爱的三角恐龙在圆形场地奔跑
- 使用 `jurassic-nursery` 库渲染
- Canvas 固定在页面底部 (`#background-scene`)
- 响应式定位 (移动端调整 `top: 30vh`)

### 页面结构

```
┌─────────────────────────────────────┐
│           Canvas (3D 背景)           │
│                                     │
│         ┌─────────────┐             │
│         │   头像      │             │
│         │   dong4j   │             │
│         │ Gifted web │             │
│         │ developer  │             │
│         └─────────────┘             │
│                                     │
│    [GitHub] [Blog] [Card] [Chat]    │
│                                     │
├─────────────────────────────────────┤
│  蜀ICP备2025119258号  🟢 Online: 1   │
└─────────────────────────────────────┘
```

### 交互功能

1. **头像缩放**：悬停时 scale(1.1)
2. **社交图标**：悬停时变色 + scale(1.2)
3. **复制按钮**：点击复制 `npx dong4j --no` 到剪贴板
4. **在线计数器**：通过 Umami Embed API 实时显示

### 外部服务集成

| 服务 | 用途 | 配置位置 |
|------|------|---------|
| Umami Analytics | 网站统计 | `index.html` 内联脚本 |
| Umami Counter | 在线人数 | `index.html` embed 脚本 |
| Font Awesome | 图标库 | CDN 引入 |
| hljs | 代码高亮 | CDN 引入 |

---

## 部署流程

### 自动部署

项目包含 `deploy.sh` 脚本，推送到 GitHub 后由 CI/CD 自动部署。

### 手动部署

```bash
bun run build
# 将 dist/ 目录内容部署到服务器
```

---

## 关键配置文件

### src/index.html

页面模板，包含：
- 内联 CSS 样式
- 社交链接 (GitHub, Blog, Card, Chat)
- Umami 统计代码
- 在线计数器 embed
- ICP 备案号

### scripts/builder.ts

构建逻辑：
- 清理 `dist/` 目录
- 使用 `Bun.build` 打包 `src/index.ts`
- 复制 HTML 和静态资源

---

## 依赖说明

### 运行时依赖

| 依赖 | 版本 | 用途 |
|------|------|------|
| gl-matrix | 3.4.3 | 3D 数学计算 |
| jurassic-nursery | git | 三角龙 3D 渲染 |

### 开发依赖

| 依赖 | 版本 | 用途 |
|------|------|------|
| bun-types | 1.0.31 | Bun TypeScript 支持 |
| chokidar | 3.6.0 | 文件监听 |
| typescript | 5.4.2 | TypeScript 编译 |

---

## 注意事项

1. **首次构建必须运行 `bun build:model`**：下载 3D 模型文件
2. **jurassic-nursery 使用 git URL**：依赖通过 git 直接引入
3. **Bun.build 配置**：`loader: { ".vert": "text", ".frag": "text" }` 处理着色器文件
4. **public/ 目录**：头像等静态资源需手动放置
5. **在线计数器**：需要 Umami 实例运行在 `umami.dong4j.site`

---

## 常见问题

1. **3D 场景不显示**：检查 `geometry.bin` 是否下载成功
2. **Bun 版本问题**：确保使用 Bun 1.0+ 
3. **构建失败**：检查 TypeScript 类型错误

---

## TODO

- [ ] 添加 sitemap
