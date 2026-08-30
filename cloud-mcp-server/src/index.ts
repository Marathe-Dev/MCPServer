import { createApp } from "./app.js";

const port = Number(process.env.PORT ?? 4000);
const host = process.env.HOST ?? "0.0.0.0";

const app = createApp();

app.httpServer.listen(port, host, () => {
  console.error(`[cloud-mcp-server] MCP endpoint: http://${host}:${port}/mcp (use the "deviceName" argument on every tool)`);
  console.error(`[cloud-mcp-server] device link endpoint: ws://${host}:${port}/device-link`);
});

process.on("SIGINT", () => {
  void app.mcpHandler.close();
  app.httpServer.close();
  process.exit(0);
});

