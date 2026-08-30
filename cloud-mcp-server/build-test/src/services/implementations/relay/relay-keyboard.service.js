/** Forwards keyboard calls over the WebSocket relay to the target device's Local Tool Service. */
export class RelayKeyboardService {
    deviceId;
    registry;
    constructor(deviceId, registry) {
        this.deviceId = deviceId;
        this.registry = registry;
    }
    typeText(input) {
        return this.registry.sendRequest(this.deviceId, "keyboard.typeText", input);
    }
    keyPress(input) {
        return this.registry.sendRequest(this.deviceId, "keyboard.keyPress", input);
    }
}
