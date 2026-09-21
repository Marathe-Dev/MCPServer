import { createServer as createHttpServer, } from "node:http";
import { createMcpHandler, } from "@modelcontextprotocol/server";
import { toNodeHandler } from "@modelcontextprotocol/node";
import { createServer } from "./server/create-server.js";
import { DeviceRegistry } from "./relay/device-registry.js";
import { createDeviceLinkServer } from "./relay/device-link-server.js";
export const MCP_PATH = /^\/mcp\/?$/;
/**
 * Builds the app (universal MCP HTTP routing + `/device-link` WS upgrade)
 * without starting to listen — kept separate from `index.ts` so tests can
 * bind an ephemeral port.
 *
 * No Express here: MCP HTTP and the WS upgrade must share one raw
 * node:http.Server, and routing three paths doesn't need a framework.
 */
export function createApp() {
    const deviceRegistry = new DeviceRegistry();
    const deviceLinkServer = createDeviceLinkServer(deviceRegistry);
    const mcpHandler = createMcpHandler(() => createServer(deviceRegistry));
    const mcpNodeHandler = toNodeHandler(mcpHandler);
    const httpServer = createHttpServer((req, res) => {
        const { pathname } = new URL(req.url ?? "/", "http://localhost");
        console.error(`[cloud-mcp-server] http ${req.method} ${pathname}`);
        if (pathname === "/") {
            res.writeHead(200, { "content-type": "application/json" });
            res.end(JSON.stringify({ status: "ok", service: "cloud-mcp-server" }));
            return;
        }
        if (MCP_PATH.test(pathname)) {
            Promise.resolve(mcpNodeHandler(req, res)).catch((error) => {
                console.error(`[cloud-mcp-server] mcp handler error: ${String(error)}`);
                if (!res.headersSent) {
                    res.writeHead(500, { "content-type": "text/plain" });
                    res.end("Internal server error");
                }
            });
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
        }
        else {
            console.error(`[cloud-mcp-server] rejected ws upgrade for unknown path: ${req.url}`);
            socket.destroy();
        }
    });
    return { httpServer, deviceRegistry, mcpHandler };
}
