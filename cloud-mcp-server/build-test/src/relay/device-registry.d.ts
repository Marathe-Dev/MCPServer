import type { WebSocket } from "ws";
import type { RelayResponseMessage, RelayToolName } from "./relay-protocol.js";
export type DeviceStatus = "online" | "offline";
/** Dashboard-facing device metadata (deviceName/platform default to deviceId/"unknown" until a register message supplies them). */
export interface DeviceInfo {
    deviceId: string;
    deviceName: string;
    platform: string;
    status: DeviceStatus;
    connectedAt: string;
    lastActive: string;
}
/**
 * Tracks connected Local Tool Service WebSocket connections keyed by
 * deviceId, and correlates outgoing tool_call requests with the matching
 * tool_result response. Devices are kept (marked "offline") after
 * disconnect rather than deleted, so the dashboard can show history for
 * the lifetime of this process.
 */
export declare class DeviceRegistry {
    private readonly devices;
    private readonly pending;
    register(deviceId: string, socket: WebSocket, meta?: {
        deviceName?: string;
        platform?: string;
    }): void;
    unregister(deviceId: string, socket: WebSocket): void;
    /** Updates lastActive without changing connection state; call on pong/tool_result traffic. */
    touch(deviceId: string): void;
    isConnected(deviceId: string): boolean;
    listConnectedDeviceIds(): string[];
    /** Full metadata for every device seen this process lifetime (including offline), for the dashboard. */
    listDevices(): DeviceInfo[];
    getDevice(deviceId: string): DeviceInfo | undefined;
    /** Resolves/rejects the pending request matching a tool_result's requestId. */
    handleResult(message: RelayResponseMessage): void;
    /** Sends a tool_call to a device and awaits its tool_result (or a timeout / offline error). */
    sendRequest<T>(deviceId: string, tool: RelayToolName, args: unknown, timeoutMs?: number): Promise<T>;
}
