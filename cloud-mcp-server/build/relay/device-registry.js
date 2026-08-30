import { randomUUID } from "node:crypto";
const DEFAULT_TIMEOUT_MS = 15000;
/**
 * Tracks connected Local Tool Service WebSocket connections keyed by
 * deviceId, and correlates outgoing tool_call requests with the matching
 * tool_result response.
 */
export class DeviceRegistry {
    devices = new Map();
    pending = new Map();
    register(deviceId, socket) {
        const existing = this.devices.get(deviceId);
        if (existing && existing !== socket) {
            existing.close(1000, "replaced by a new connection");
        }
        this.devices.set(deviceId, socket);
    }
    unregister(deviceId, socket) {
        if (this.devices.get(deviceId) === socket) {
            this.devices.delete(deviceId);
        }
    }
    isConnected(deviceId) {
        return this.devices.has(deviceId);
    }
    listConnectedDeviceIds() {
        return [...this.devices.keys()].sort((left, right) => left.localeCompare(right));
    }
    /** Resolves/rejects the pending request matching a tool_result's requestId. */
    handleResult(message) {
        const pending = this.pending.get(message.requestId);
        if (!pending)
            return;
        clearTimeout(pending.timeoutHandle);
        this.pending.delete(message.requestId);
        if (message.ok) {
            pending.resolve(message.result);
        }
        else {
            pending.reject(new Error(message.error));
        }
    }
    /** Sends a tool_call to a device and awaits its tool_result (or a timeout / offline error). */
    async sendRequest(deviceId, tool, args, timeoutMs = DEFAULT_TIMEOUT_MS) {
        const socket = this.devices.get(deviceId);
        if (!socket) {
            console.error(`[cloud-mcp-server] sendRequest failed: device "${deviceId}" is not connected`);
            throw new Error(`Device "${deviceId}" is not connected`);
        }
        const requestId = randomUUID();
        const message = {
            type: "tool_call",
            requestId,
            tool,
            args,
        };
        console.error(`[cloud-mcp-server] relay tool_call requestId=${requestId} deviceId=${deviceId} tool=${tool}`);
        return new Promise((resolve, reject) => {
            const timeoutHandle = setTimeout(() => {
                this.pending.delete(requestId);
                console.error(`[cloud-mcp-server] relay tool_call timed out requestId=${requestId} tool=${tool}`);
                reject(new Error(`Device "${deviceId}" did not respond to "${tool}" within ${timeoutMs}ms`));
            }, timeoutMs);
            this.pending.set(requestId, {
                resolve: ((result) => {
                    console.error(`[cloud-mcp-server] relay tool_result requestId=${requestId} tool=${tool} ok=true`);
                    resolve(result);
                }),
                reject: (error) => {
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
