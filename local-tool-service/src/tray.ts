import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { platform } from "node:os";
import { fileURLToPath } from "node:url";
import type { ClickEvent, MenuItem } from "systray2";
import type { RelayClient } from "./relay/relay-client.js";

// systray2 is CommonJS-only; require() it directly rather than fighting
// ESM/CJS default-export interop under Node16 module resolution.
const require = createRequire(import.meta.url);
const SysTray: typeof import("systray2").default = require("systray2");

// systray2's own MenuItem type omits the `click` callback its README relies
// on; the native binary round-trips the same JS object, so it's safe.
interface ClickableMenuItem extends MenuItem {
  click?: () => void;
}

const ASSETS_DIR = fileURLToPath(new URL("../assets/", import.meta.url));
const STATUS_POLL_MS = 5000;

/**
 * Shows a system tray icon with connection status, device id (click to
 * copy), open logs, and quit. Falls back to headless (no tray) if icon
 * assets are missing — add `assets/icon.ico` (Windows) and
 * `assets/icon.png` (macOS/Linux) to enable it.
 */
export function startTray(
  deviceId: string,
  client: RelayClient,
): InstanceType<typeof SysTray> | undefined {
  const iconPath = `${ASSETS_DIR}${platform() === "win32" ? "icon.ico" : "icon.png"}`;
  if (!existsSync(iconPath)) {
    console.error(`[local-tool-service] tray icon not found at ${iconPath}, running headless`);
    return undefined;
  }

  const statusItem = {
    title: statusLabel(client),
    tooltip: "",
    checked: false,
    enabled: false,
  };
  const deviceItem = {
    title: `Device ID: ${deviceId}`,
    tooltip: "Click to copy",
    checked: false,
    enabled: true,
    click: () => copyToClipboard(deviceId),
  };
  const quitItem = {
    title: "Quit",
    tooltip: "",
    checked: false,
    enabled: true,
    click: () => {
      client.stop();
      tray.kill(false);
    },
  };

  const tray = new SysTray({
    menu: {
      icon: iconPath,
      isTemplateIcon: platform() === "darwin",
      title: "Local Tool Service",
      tooltip: "Local Tool Service",
      items: [statusItem, deviceItem, SysTray.separator, quitItem],
    },
  });

  tray.onClick((action: ClickEvent) => {
    (action.item as ClickableMenuItem).click?.();
  });

  const statusPoll = setInterval(() => {
    statusItem.title = statusLabel(client);
    tray.sendAction({ type: "update-item", item: statusItem });
  }, STATUS_POLL_MS);
  tray.ready().catch((error: unknown) => {
    clearInterval(statusPoll);
    console.error(`[local-tool-service] tray failed to start: ${String(error)}`);
  });

  return tray;
}

function statusLabel(client: RelayClient): string {
  return client.isConnected() ? "Status: Connected" : "Status: Disconnected";
}

/** Best-effort clipboard copy; silently no-ops if the platform tool is unavailable. */
function copyToClipboard(text: string): void {
  const plat = platform();
  const [command, args] =
    plat === "win32"
      ? ["clip", []]
      : plat === "darwin"
        ? ["pbcopy", []]
        : ["xclip", ["-selection", "clipboard"]];
  const child = execFile(command, args, (error) => {
    if (error) {
      console.error(`[local-tool-service] clipboard copy failed: ${String(error)}`);
    }
  });
  child.stdin?.end(text);
}
