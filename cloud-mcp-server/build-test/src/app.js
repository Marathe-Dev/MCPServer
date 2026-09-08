import { createServer as createHttpServer } from "node:http";
import { createMcpHandler, } from "@modelcontextprotocol/server";
import { toNodeHandler } from "@modelcontextprotocol/node";
import express from "express";
import { createServer } from "./server/create-server.js";
import { DeviceRegistry } from "./relay/device-registry.js";
import { createDeviceLinkServer } from "./relay/device-link-server.js";
export const MCP_PATH = /^\/mcp\/?$/;
/**
 * Builds the app (universal MCP HTTP routing + `/device-link` WS upgrade)
 * without starting to listen — kept separate from `index.ts` so tests can
 * bind an ephemeral port.
 */
export function createApp() {
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
    expressApp.all(MCP_PATH, (req, res) => {
        Promise.resolve(mcpNodeHandler(req, res)).catch((error) => {
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
        }
        else {
            console.error(`[cloud-mcp-server] rejected ws upgrade for unknown path: ${req.url}`);
            socket.destroy();
        }
    });
    return { httpServer, deviceRegistry, mcpHandler };
}
