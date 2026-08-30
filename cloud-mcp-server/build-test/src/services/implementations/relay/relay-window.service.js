/** Forwards window-list calls over the WebSocket relay to the target device's Local Tool Service. */
export class RelayWindowService {
    deviceId;
    registry;
    constructor(deviceId, registry) {
        this.deviceId = deviceId;
        this.registry = registry;
    }
    listWindows() {
        return this.registry.sendRequest(this.deviceId, "window.listWindows", {});
    }
}
