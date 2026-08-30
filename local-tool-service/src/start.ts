import { loadConfig } from "./config.js";
import { RelayClient } from "./relay/relay-client.js";
import { createDispatcher } from "./relay/dispatcher.js";
import { NutjsMouseService } from "./services/implementations/nutjs/nutjs-mouse.service.js";
import { NutjsKeyboardService } from "./services/implementations/nutjs/nutjs-keyboard.service.js";
import { NutjsScreenshotService } from "./services/implementations/nutjs/nutjs-screenshot.service.js";
import { NutjsWindowService } from "./services/implementations/nutjs/nutjs-window.service.js";

/** Wires config + real nut-js services + the relay client together and connects. */
export function start(): RelayClient {
  const { deviceId, cloudUrl } = loadConfig();

  const services = {
    mouseService: new NutjsMouseService(),
    keyboardService: new NutjsKeyboardService(),
    screenshotService: new NutjsScreenshotService(),
    windowService: new NutjsWindowService(),
  };

  const client = new RelayClient(cloudUrl, deviceId);
  client.onToolCallMessage(createDispatcher(services, client));
  client.connect();

  console.error(`[local-tool-service] device id: ${deviceId}`);
  console.error(`[local-tool-service] cloud url: ${cloudUrl}`);

  return client;
}
