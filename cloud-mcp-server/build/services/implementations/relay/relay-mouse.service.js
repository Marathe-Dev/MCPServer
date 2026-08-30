/** Forwards mouse calls over the WebSocket relay to the target device's Local Tool Service. */
export class RelayMouseService {
    deviceId;
    registry;
    constructor(deviceId, registry) {
        this.deviceId = deviceId;
        this.registry = registry;
    }
    move(input) {
        return this.registry.sendRequest(this.deviceId, "mouse.move", input);
    }
    click(input) {
        return this.registry.sendRequest(this.deviceId, "mouse.click", input);
    }
}
