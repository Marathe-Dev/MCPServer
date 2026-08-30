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
 * Builds the full app (universal MCP HTTP routing + `/device-link` WS
 * upgrade) without starting to listen — kept separate from `index.ts` so
 * tests can bind an ephemeral port.
 */
export declare function createApp(): CloudApp;
