import { type Server } from "node:http";
import { type McpHttpHandler } from "@modelcontextprotocol/server";
import { DeviceRegistry } from "./relay/device-registry.js";
export declare const MCP_PATH: RegExp;
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
export declare function createApp(): CloudApp;
