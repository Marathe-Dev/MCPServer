import { type Server } from "node:http";
import { type McpHttpHandler } from "@modelcontextprotocol/server";
import { DeviceRegistry } from "./relay/device-registry.js";
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
export declare function createApp(): CloudApp;
