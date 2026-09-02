import type { RelayMessage, RelayRequestMessage } from "./relay-protocol.js";
export type ToolCallHandler = (message: RelayRequestMessage) => void;
/**
 * Maintains an outbound WebSocket connection to the Cloud MCP Server's
 * `/device-link` endpoint, with reconnect-with-backoff and heartbeat
 * ping/pong.
 */
export declare class RelayClient {
    private readonly cloudUrl;
    private readonly deviceId;
    private readonly deviceName?;
    private readonly platform?;
    private socket;
    private reconnectDelayMs;
    private stopped;
    private connected;
    private onToolCall;
    constructor(cloudUrl: string, deviceId: string, deviceName?: string | undefined, platform?: string | undefined);
    onToolCallMessage(handler: ToolCallHandler): void;
    isConnected(): boolean;
    connect(): void;
    stop(): void;
    send(message: RelayMessage): void;
    private open;
    private scheduleReconnect;
}
