import { McpServer } from "@modelcontextprotocol/server";
import type { DeviceRegistry } from "../relay/device-registry.js";
/**
 * Builds the one, universal MCP server instance. Every tool takes a
 * `deviceName` argument and resolves its own relay services per call — the
 * server itself is not bound to any single device.
 */
export declare function createServer(deviceRegistry: DeviceRegistry): McpServer;
