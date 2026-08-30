import type { WebSocket } from "ws";
import type { RelayResponseMessage, RelayToolName } from "./relay-protocol.js";
/**
 * Tracks connected Local Tool Service WebSocket connections keyed by
 * deviceId, and correlates outgoing tool_call requests with the matching
 * tool_result response.
 */
export declare class DeviceRegistry {
    private readonly devices;
    private readonly pending;
    register(deviceId: string, socket: WebSocket): void;
    unregister(deviceId: string, socket: WebSocket): void;
    isConnected(deviceId: string): boolean;
    /** IDs of every currently connected Local Tool Service, for discovery and error messages. */
    listConnectedDeviceIds(): string[];
    /** Resolves/rejects the pending request matching a tool_result's requestId. */
    handleResult(message: RelayResponseMessage): void;
    /** Sends a tool_call to a device and awaits its tool_result (or a timeout / offline error). */
    sendRequest<T>(deviceId: string, tool: RelayToolName, args: unknown, timeoutMs?: number): Promise<T>;
}
