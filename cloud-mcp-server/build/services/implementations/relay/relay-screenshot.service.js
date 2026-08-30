/** Forwards screenshot calls over the WebSocket relay to the target device's Local Tool Service. */
export class RelayScreenshotService {
    deviceId;
    registry;
    constructor(deviceId, registry) {
        this.deviceId = deviceId;
        this.registry = registry;
    }
    capturePrimaryDisplay() {
        return this.registry.sendRequest(this.deviceId, "screenshot.capturePrimaryDisplay", {});
    }
}
