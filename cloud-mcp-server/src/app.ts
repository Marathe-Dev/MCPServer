import {
  createServer as createHttpServer,
  type IncomingMessage,
  type ServerResponse,
  type Server,
} from "node:http";
import { readFileSync } from "node:fs";
import { dirname, extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createMcpHandler,
  type McpHttpHandler,
} from "@modelcontextprotocol/server";
import { toNodeHandler } from "@modelcontextprotocol/node";
import { createServer } from "./server/create-server.js";
import { DeviceRegistry } from "./relay/device-registry.js";
import { createDeviceLinkServer } from "./relay/device-link-server.js";

export const MCP_PATH = /^\/mcp\/?$/;

// public/ sits next to src/ and build/, so this resolves the same way whether run via ts-node or from build/app.js.
const PUBLIC_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..", "public");

const STATIC_CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".svg": "image/svg+xml",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

/** Reads a file under public/, rejecting any path that escapes it; undefined if missing. */
function readPublicFile(relativePath: string): { body: Buffer; contentType: string } | undefined {
  const fullPath = resolve(PUBLIC_DIR, "." + relativePath);
  if (fullPath !== PUBLIC_DIR && !fullPath.startsWith(PUBLIC_DIR + sep)) return undefined;
  try {
    const contentType = STATIC_CONTENT_TYPES[extname(fullPath)] ?? "application/octet-stream";
    return { body: readFileSync(fullPath), contentType };
  } catch {
    return undefined;
  }
}

const landingPage = readPublicFile("/index.html");

export interface CloudApp {
  httpServer: Server;
  deviceRegistry: DeviceRegistry;
  mcpHandler: McpHttpHandler;
}

/**
 * Builds the app (universal MCP HTTP routing + `/device-link` WS upgrade)
 * without starting to listen — kept separate from `index.ts` so tests can
 * bind an ephemeral port.
 *
 * No Express here: MCP HTTP and the WS upgrade must share one raw
 * node:http.Server, and routing three paths doesn't need a framework.
 */
export function createApp(): CloudApp {
  const deviceRegistry = new DeviceRegistry();
  const deviceLinkServer = createDeviceLinkServer(deviceRegistry);

  const mcpHandler = createMcpHandler(() => createServer(deviceRegistry));
  const mcpNodeHandler = toNodeHandler(mcpHandler);

  const httpServer = createHttpServer((req: IncomingMessage, res: ServerResponse) => {
    const { pathname } = new URL(req.url ?? "/", "http://localhost");
    console.error(`[cloud-mcp-server] http ${req.method} ${pathname}`);

    if (pathname === "/") {
      if (landingPage) {
        res.writeHead(200, { "content-type": landingPage.contentType });
        res.end(landingPage.body);
      } else {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ status: "ok", service: "cloud-mcp-server" }));
      }
      return;
    }

    if (pathname === "/health") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ status: "ok", service: "cloud-mcp-server" }));
      return;
    }

    if (MCP_PATH.test(pathname)) {
      Promise.resolve(mcpNodeHandler(req, res)).catch((error: unknown) => {
        console.error(`[cloud-mcp-server] mcp handler error: ${String(error)}`);
        if (!res.headersSent) {
          res.writeHead(500, { "content-type": "text/plain" });
          res.end("Internal server error");
        }
      });
      return;
    }

    const staticFile = readPublicFile(pathname);
    if (staticFile) {
      res.writeHead(200, { "content-type": staticFile.contentType });
      res.end(staticFile.body);
      return;
    }

    console.error(`[cloud-mcp-server] 404 ${pathname}`);
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("Not found. Connect an MCP client to /mcp.");
  });

  // For WebSocket handshake - share one port for both normal HTTP (/mcp) and WebSocket (/device-link).
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
