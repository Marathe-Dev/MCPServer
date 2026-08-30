import WebSocket from "ws";
import { parseRelayMessage } from "./relay-protocol.js";
const RECONNECT_MIN_MS = 1000;
const RECONNECT_MAX_MS = 30000;
/**
 * Maintains an outbound WebSocket connection to the Cloud MCP Server's
 * `/device-link` endpoint, with reconnect-with-backoff and heartbeat
 * ping/pong.
 */
export class RelayClient {
    cloudUrl;
    deviceId;
    socket;
    reconnectDelayMs = RECONNECT_MIN_MS;
    stopped = false;
    connected = false;
    onToolCall = () => { };
    constructor(cloudUrl, deviceId) {
        this.cloudUrl = cloudUrl;
        this.deviceId = deviceId;
    }
    onToolCallMessage(handler) {
        this.onToolCall = handler;
    }
    isConnected() {
        return this.connected;
    }
    connect() {
        this.stopped = false;
        this.open();
    }
    stop() {
        this.stopped = true;
        this.socket?.close();
    }
    send(message) {
        if (this.socket?.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify(message));
        }
    }
    open() {
        const url = `${this.cloudUrl.replace(/\/$/, "")}/device-link`;
        const socket = new WebSocket(url);
        this.socket = socket;
        socket.on("open", () => {
            this.connected = true;
            this.reconnectDelayMs = RECONNECT_MIN_MS;
            console.error(`[local-tool-service] connected to ${url}`);
            this.send({ type: "register", deviceId: this.deviceId });
        });
        socket.on("message", (raw) => {
            let message;
            try {
                message = parseRelayMessage(raw.toString());
            }
            catch (error) {
                console.error(`[local-tool-service] invalid relay message: ${String(error)}`);
                return;
            }
            if (message.type === "ping") {
                this.send({ type: "pong" });
            }
            else if (message.type === "tool_call") {
                this.onToolCall(message);
            }
        });
        socket.on("close", () => {
            this.connected = false;
            console.error("[local-tool-service] disconnected from cloud server");
            if (!this.stopped)
                this.scheduleReconnect();
        });
        socket.on("error", (error) => {
            console.error(`[local-tool-service] connection error: ${String(error)}`);
        });
    }
    scheduleReconnect() {
        const delay = this.reconnectDelayMs;
        console.error(`[local-tool-service] reconnecting in ${delay}ms`);
        setTimeout(() => {
            if (!this.stopped)
                this.open();
        }, delay);
        this.reconnectDelayMs = Math.min(this.reconnectDelayMs * 2, RECONNECT_MAX_MS);
    }
}
