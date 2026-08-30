import type { RelayClient } from "./relay/relay-client.js";
declare const SysTray: typeof import("systray2").default;
/**
 * Shows a system tray icon with connection status, device id (click to
 * copy), open logs, and quit. Falls back to headless (no tray) if icon
 * assets are missing — add `assets/icon.ico` (Windows) and
 * `assets/icon.png` (macOS/Linux) to enable it.
 */
export declare function startTray(deviceId: string, client: RelayClient): InstanceType<typeof SysTray> | undefined;
export {};
