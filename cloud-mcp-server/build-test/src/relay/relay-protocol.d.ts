/**
 * Wire protocol for the WebSocket relay between the Cloud MCP Server and
 * each connected Local Tool Service. Kept identical (copy) in both projects.
 */
/** Mirrors the local service's dispatch 1:1 so both ends can dispatch with a plain switch. */
export type RelayToolName = "mouse" | "keyboard" | "screenshot.capture" | "window.listWindows" | "cmd.execute" | "file.read";
export interface RegisterMessage {
    type: "register";
    deviceId: string;
    /** Friendly hostname and OS platform, sent so the cloud can show device metadata. */
    deviceName?: string;
    platform?: string;
}
export interface PingMessage {
    type: "ping";
}
export interface PongMessage {
    type: "pong";
}
export interface RelayRequestMessage {
    type: "tool_call";
    requestId: string;
    tool: RelayToolName;
    args: unknown;
}
export interface RelaySuccessMessage {
    type: "tool_result";
    requestId: string;
    ok: true;
    result: unknown;
}
export interface RelayErrorMessage {
    type: "tool_result";
    requestId: string;
    ok: false;
    error: string;
}
export type RelayResponseMessage = RelaySuccessMessage | RelayErrorMessage;
export type RelayMessage = RegisterMessage | PingMessage | PongMessage | RelayRequestMessage | RelayResponseMessage;
/** Parses and minimally validates one JSON relay frame. */
export declare function parseRelayMessage(raw: string): RelayMessage;
