import { WebSocketServer } from "ws";
import type { DeviceRegistry } from "./device-registry.js";
/** Accepts Local Tool Service connections at `/device-link` and wires them into the device registry. */
export declare function createDeviceLinkServer(registry: DeviceRegistry): WebSocketServer;
