import type { McpServer } from "@modelcontextprotocol/server";
import type { DeviceRegistry } from "../relay/device-registry.js";
/**
 * `list_devices` — lists the deviceName of every currently connected Local
 * Tool Service, so an agent can discover valid targets for the other tools.
 */
export declare function registerListDevicesTool(server: McpServer, deviceRegistry: DeviceRegistry): void;
