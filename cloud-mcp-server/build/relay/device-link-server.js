import { WebSocketServer } from "ws";
import { parseRelayMessage } from "./relay-protocol.js";
const HEARTBEAT_INTERVAL_MS = 30000;
/** Accepts Local Tool Service connections at `/device-link` and wires them into the device registry. */
export function createDeviceLinkServer(registry) {
    const wss = new WebSocketServer({ noServer: true });
    wss.on("connection", (socket, _req) => {
        let deviceId;
        socket.on("message", (raw) => {
            let message;
            try {
                message = parseRelayMessage(raw.toString());
            }
            catch (error) {
                console.error(`[cloud-mcp-server] invalid relay message: ${String(error)}`);
                return;
            }
            switch (message.type) {
                case "register":
                    deviceId = message.deviceId;
                    registry.register(deviceId, socket, {
                        deviceName: message.deviceName,
                        platform: message.platform,
                    });
                    console.error(`[cloud-mcp-server] device registered: ${deviceId}`);
                    break;
                case "tool_result":
                    registry.handleResult(message);
                    if (deviceId)
                        registry.touch(deviceId);
                    break;
                case "pong":
                    if (deviceId)
                        registry.touch(deviceId);
                    break;
                default:
                    console.error(`[cloud-mcp-server] unexpected message type from device: ${message.type}`);
            }
        });
        const heartbeat = setInterval(() => {
            if (socket.readyState === socket.OPEN) {
                socket.send(JSON.stringify({ type: "ping" }));
            }
        }, HEARTBEAT_INTERVAL_MS);
        socket.on("close", () => {
            clearInterval(heartbeat);
            if (deviceId) {
                registry.unregister(deviceId, socket);
                console.error(`[cloud-mcp-server] device disconnected: ${deviceId}`);
            }
        });
        socket.on("error", (error) => {
            console.error(`[cloud-mcp-server] device socket error: ${String(error)}`);
        });
    });
    return wss;
}
