import type { McpServer } from "@modelcontextprotocol/server";
import type { DeviceRegistry } from "../relay/device-registry.js";
/** Registers every RemotePC MCP tool on the given server instance. */
export declare function registerAllTools(server: McpServer, deviceRegistry: DeviceRegistry): void;
