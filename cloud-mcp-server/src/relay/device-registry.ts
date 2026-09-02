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

interface DeviceEntry {
  socket: WebSocket | undefined;
  info: DeviceInfo;
}

const DEFAULT_TIMEOUT_MS = 15000;

/**
 * Tracks connected Local Tool Service WebSocket connections keyed by
 * deviceId, and correlates outgoing tool_call requests with the matching
 * tool_result response. Devices are kept (marked "offline") after
 * disconnect rather than deleted, so the dashboard can show history for
 * the lifetime of this process.
 */
export class DeviceRegistry {
  private readonly devices = new Map<string, DeviceEntry>();
  private readonly pending = new Map<string, PendingRequest>();

  register(
    deviceId: string,
    socket: WebSocket,
    meta?: { deviceName?: string; platform?: string },
  ): void {
    const existing = this.devices.get(deviceId);
    if (existing?.socket && existing.socket !== socket) {
      existing.socket.close(1000, "replaced by a new connection");
    }
    const now = new Date().toISOString();
    this.devices.set(deviceId, {
      socket,
      info: {
        deviceId,
        deviceName: meta?.deviceName ?? existing?.info.deviceName ?? deviceId,
        platform: meta?.platform ?? existing?.info.platform ?? "unknown",
        status: "online",
        connectedAt: existing?.info.connectedAt ?? now,
        lastActive: now,
      },
    });
  }

  unregister(deviceId: string, socket: WebSocket): void {
    const entry = this.devices.get(deviceId);
    if (entry?.socket === socket) {
      entry.socket = undefined;
      entry.info = { ...entry.info, status: "offline", lastActive: new Date().toISOString() };
    }
  }

  /** Updates lastActive without changing connection state; call on pong/tool_result traffic. */
  touch(deviceId: string): void {
    const entry = this.devices.get(deviceId);
    if (entry) {
      entry.info = { ...entry.info, lastActive: new Date().toISOString() };
    }
  }

  isConnected(deviceId: string): boolean {
    return this.devices.get(deviceId)?.socket !== undefined;
  }

  listConnectedDeviceIds(): string[] {
    return [...this.devices.entries()]
      .filter(([, entry]) => entry.socket !== undefined)
      .map(([deviceId]) => deviceId)
      .sort((left, right) => left.localeCompare(right));
  }

  /** Full metadata for every device seen this process lifetime (including offline), for the dashboard. */
  listDevices(): DeviceInfo[] {
    return [...this.devices.values()]
      .map((entry) => entry.info)
      .sort((left, right) => left.deviceName.localeCompare(right.deviceName));
  }

  getDevice(deviceId: string): DeviceInfo | undefined {
    return this.devices.get(deviceId)?.info;
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
    const socket = this.devices.get(deviceId)?.socket;
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
