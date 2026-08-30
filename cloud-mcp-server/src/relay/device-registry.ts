import { randomUUID } from "node:crypto";
import type { WebSocket } from "ws";
import type {
  RelayRequestMessage,
  RelayResponseMessage,
  RelayToolName,
} from "./relay-protocol.js";

interface PendingRequest {
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
  timeoutHandle: NodeJS.Timeout;
}

const DEFAULT_TIMEOUT_MS = 15000;

/**
 * Tracks connected Local Tool Service WebSocket connections keyed by
 * deviceId, and correlates outgoing tool_call requests with the matching
 * tool_result response.
 */
export class DeviceRegistry {
  private readonly devices = new Map<string, WebSocket>();
  private readonly pending = new Map<string, PendingRequest>();

  register(deviceId: string, socket: WebSocket): void {
    const existing = this.devices.get(deviceId);
    if (existing && existing !== socket) {
      existing.close(1000, "replaced by a new connection");
    }
    this.devices.set(deviceId, socket);
  }

  unregister(deviceId: string, socket: WebSocket): void {
    if (this.devices.get(deviceId) === socket) {
      this.devices.delete(deviceId);
    }
  }

  isConnected(deviceId: string): boolean {
    return this.devices.has(deviceId);
  }

  listConnectedDeviceIds(): string[] {
    return [...this.devices.keys()].sort((left, right) => left.localeCompare(right));
  }

  /** Resolves/rejects the pending request matching a tool_result's requestId. */
  handleResult(message: RelayResponseMessage): void {
    const pending = this.pending.get(message.requestId);
    if (!pending) return;
    clearTimeout(pending.timeoutHandle);
    this.pending.delete(message.requestId);
    if (message.ok) {
      pending.resolve(message.result);
    } else {
      pending.reject(new Error(message.error));
    }
  }

  /** Sends a tool_call to a device and awaits its tool_result (or a timeout / offline error). */
  async sendRequest<T>(
    deviceId: string,
    tool: RelayToolName,
    args: unknown,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  ): Promise<T> {
    const socket = this.devices.get(deviceId);
    if (!socket) {
      console.error(`[cloud-mcp-server] sendRequest failed: device "${deviceId}" is not connected`);
      throw new Error(`Device "${deviceId}" is not connected`);
    }

    const requestId = randomUUID();
    const message: RelayRequestMessage = {
      type: "tool_call",
      requestId,
      tool,
      args,
    };
    console.error(`[cloud-mcp-server] relay tool_call requestId=${requestId} deviceId=${deviceId} tool=${tool}`);

    return new Promise<T>((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        this.pending.delete(requestId);
        console.error(`[cloud-mcp-server] relay tool_call timed out requestId=${requestId} tool=${tool}`);
        reject(
          new Error(
            `Device "${deviceId}" did not respond to "${tool}" within ${timeoutMs}ms`,
          ),
        );
      }, timeoutMs);

      this.pending.set(requestId, {
        resolve: ((result: unknown) => {
          console.error(`[cloud-mcp-server] relay tool_result requestId=${requestId} tool=${tool} ok=true`);
          resolve(result as T);
        }) as (result: unknown) => void,
        reject: (error: Error) => {
          console.error(`[cloud-mcp-server] relay tool_result requestId=${requestId} tool=${tool} ok=false error=${error.message}`);
          reject(error);
        },
        timeoutHandle,
      });

      socket.send(JSON.stringify(message), (error) => {
        if (error) {
          clearTimeout(timeoutHandle);
          this.pending.delete(requestId);
          console.error(`[cloud-mcp-server] relay tool_call send failed requestId=${requestId} error=${String(error)}`);
          reject(error);
        }
      });
    });
  }
}
