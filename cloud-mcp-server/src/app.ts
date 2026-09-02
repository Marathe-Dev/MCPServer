import { createServer as createHttpServer, type Server } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createMcpHandler,
  type McpHttpHandler,
} from "@modelcontextprotocol/server";
import { toNodeHandler } from "@modelcontextprotocol/node";
import express, { json } from "express";
import { createServer } from "./server/create-server.js";
import { DeviceRegistry } from "./relay/device-registry.js";
import { createDeviceLinkServer } from "./relay/device-link-server.js";
import { createDashboardRouter } from "./api/dashboard-router.js";

export const MCP_PATH = /^\/mcp\/?$/;

/** `dashboard/` lives next to `src`/`build`, one level above this compiled file. */
const DASHBOARD_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "dashboard");

export interface CloudApp {
  httpServer: Server;
  deviceRegistry: DeviceRegistry;
  mcpHandler: McpHttpHandler;
}

/**
 * Builds the full app (universal MCP HTTP routing + REST dashboard API +
 * static dashboard UI + `/device-link` WS upgrade) without starting to
 * listen — kept separate from `index.ts` so tests can bind an ephemeral
 * port.
 */
export function createApp(): CloudApp {
  const deviceRegistry = new DeviceRegistry();
  const deviceLinkServer = createDeviceLinkServer(deviceRegistry);

  const mcpHandler = createMcpHandler(() => createServer(deviceRegistry));
  const mcpNodeHandler = toNodeHandler(mcpHandler);

  const expressApp = express();
  expressApp.use((req, _res, next) => {
    console.error(`[cloud-mcp-server] http ${req.method} ${req.path}`);
    next();
  });

  expressApp.get("/", (_req, res) => {
    res.json({ status: "ok", service: "cloud-mcp-server" });
  });

  // `json()` is scoped to /api only so it never consumes the MCP endpoint's
  // own request stream (Streamable HTTP reads the raw body itself).
  expressApp.use("/api", json(), createDashboardRouter(deviceRegistry));

  expressApp.use("/dashboard", express.static(DASHBOARD_DIR));

  expressApp.all(MCP_PATH, (req, res) => {
    Promise.resolve(mcpNodeHandler(req, res)).catch((error: unknown) => {
      console.error(`[cloud-mcp-server] mcp handler error: ${String(error)}`);
      if (!res.headersSent) {
        res.writeHead(500, { "content-type": "text/plain" });
        res.end("Internal server error");
      }
    });
  });

  expressApp.use((_req, res) => {
    res.status(404).type("text/plain").send("Not found. Connect an MCP client to /mcp.");
  });

  const httpServer = createHttpServer(expressApp);

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
