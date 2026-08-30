/**
 * Wire protocol for the WebSocket relay between the Cloud MCP Server and
 * each connected Local Tool Service. Kept identical (copy) in both projects.
 */

/** Mirrors the 4 I*Service method names 1:1 so dispatch is a plain switch on both ends. */
export type RelayToolName =
  | "mouse.move"
  | "mouse.click"
  | "keyboard.typeText"
  | "keyboard.keyPress"
  | "screenshot.capturePrimaryDisplay"
  | "window.listWindows";

export interface RegisterMessage {
  type: "register";
  deviceId: string;
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

export type RelayMessage =
  | RegisterMessage
  | PingMessage
  | PongMessage
  | RelayRequestMessage
  | RelayResponseMessage;

/** Parses and minimally validates one JSON relay frame. */
export function parseRelayMessage(raw: string): RelayMessage {
  const parsed: unknown = JSON.parse(raw);
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    typeof (parsed as { type?: unknown }).type !== "string"
  ) {
    throw new Error('Invalid relay message: missing "type"');
  }
  return parsed as RelayMessage;
}
