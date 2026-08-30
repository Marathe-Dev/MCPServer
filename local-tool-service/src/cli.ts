#!/usr/bin/env node
import { loadConfig } from "./config.js";
import { install, uninstall } from "./install/index.js";
import { start } from "./start.js";
import { startTray } from "./tray.js";

const command = process.argv[2] ?? "start";

switch (command) {
  case "install":
    await install();
    break;
  case "uninstall":
    await uninstall();
    break;
  case "start": {
    const client = start();
    if (process.env.NO_TRAY !== "1") {
      const { deviceId } = loadConfig();
      startTray(deviceId, client);
    }
    break;
  }
  default:
    console.error(`Unknown command "${command}". Use: start | install | uninstall`);
    process.exit(1);
}
