import chokidar from "chokidar";
import { build } from "./builder";

interface SSEClient {
  id: string;
  controller: ReadableStreamDefaultController;
}

const clients = new Map<string, SSEClient>();
let clientIdCounter = 0;

chokidar
  .watch(__dirname + "/../src")
  .on("all", () => build().catch(console.error));

Bun.serve({
  port: parseInt(process.env.PORT || "3000"),
  async fetch(req) {
    const { pathname } = new URL(req.url);

    if (pathname === "/api/wakatime/stream") {
      if (req.method === "POST") {
        const contentType = req.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          const body = await req.json();
          broadcast(JSON.stringify(body));
          return new Response(JSON.stringify({ success: true }), {
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response("Expected JSON", { status: 400 });
      }

      if (req.method === "GET") {
        const clientId = String(++clientIdCounter);
        const stream = new ReadableStream({
          start(controller) {
            clients.set(clientId, { id: clientId, controller });
            const encoder = new TextEncoder();
            controller.enqueue(encoder.encode(`data: connected\n\n`));
          },
          cancel() {
            clients.delete(clientId);
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
          },
        });
      }
    }

    let filePath = pathname;
    if (pathname === "/") filePath = "/index.html";
    const file = Bun.file(__dirname + "/../dist" + filePath);
    if (await file.exists()) {
      return new Response(file);
    }
    return new Response("Not Found", { status: 404 });
  },
});

function broadcast(data: string) {
  const encoder = new TextEncoder();
  const message = `data: ${data}\n\n`;
  for (const client of clients.values()) {
    try {
      client.controller.enqueue(encoder.encode(message));
    } catch {
      clients.delete(client.id);
    }
  }
}

console.log(`Server running at http://localhost:${process.env.PORT || 3000}`);
