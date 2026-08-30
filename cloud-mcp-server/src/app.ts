import { createServer as createHttpServer, type Server } from "node:http";
import { createMcpHandler, type McpHttpHandler } from "@modelcontextprotocol/server";
import { toNodeHandler } from "@modelcontextprotocol/node";
import { createServer } from "./server/create-server.js";
import { DeviceRegistry } from "./relay/device-registry.js";
import { createDeviceLinkServer } from "./relay/device-link-server.js";

const MCP_PATH = /^\/mcp\/?$/;

export interface CloudApp {
  httpServer: Server;
  deviceRegistry: DeviceRegistry;
  mcpHandler: McpHttpHandler;
}

/**
 * Builds the full app: one universal MCP endpoint (`/mcp`, every tool takes
 * a `deviceName` argument) plus the `/device-link` WS upgrade — without
 * starting to listen, so tests can bind an ephemeral port.
 */
export function createApp(): CloudApp {
  const deviceRegistry = new DeviceRegistry();
  const deviceLinkServer = createDeviceLinkServer(deviceRegistry);

  // One global server for every agent — device selection now happens per
  // tool call (via each tool's `deviceName` argument), not per connection.
  const mcpHandler = createMcpHandler(() => createServer(deviceRegistry));
  const mcpNodeHandler = toNodeHandler(mcpHandler);

  const httpServer = createHttpServer((req, res) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    console.error(`[cloud-mcp-server] http ${req.method} ${url.pathname}`);
    if (!MCP_PATH.test(url.pathname)) {
      console.error(`[cloud-mcp-server] 404 for ${url.pathname}`);
      res.writeHead(404, { "content-type": "text/plain" });
      res.end("Not found. Connect an MCP client to /mcp.");
      return;
    }
    Promise.resolve(mcpNodeHandler(req, res)).catch((error: unknown) => {
      console.error(`[cloud-mcp-server] mcp handler error: ${String(error)}`);
      if (!res.headersSent) {
        res.writeHead(500, { "content-type": "text/plain" });
        res.end("Internal server error");
      }
    });
  });

  httpServer.on("upgrade", (req, socket, head) => {
    console.error(`[cloud-mcp-server] ws upgrade request: ${req.url}`);
    if (req.url === "/device-link") {
      deviceLinkServer.handleUpgrade(req, socket, head, (ws) => {
        deviceLinkServer.emit("connection", ws, req);
      });
    } else {
      console.error(`[cloud-mcp-server] rejected ws upgrade for unknown path: ${req.url}`);
      socket.destroy();
    }
  });

  return { httpServer, deviceRegistry, mcpHandler };
}
