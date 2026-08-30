import { platform } from "node:os";

/** Dispatches install/uninstall to the right per-user autostart mechanism for the current OS. */
export async function install(): Promise<void> {
  switch (platform()) {
    case "win32":
      return (await import("./install-windows.js")).install();
    case "darwin":
      return (await import("./install-macos.js")).install();
    default:
      return (await import("./install-linux.js")).install();
  }
}

export async function uninstall(): Promise<void> {
  switch (platform()) {
    case "win32":
      return (await import("./install-windows.js")).uninstall();
    case "darwin":
      return (await import("./install-macos.js")).uninstall();
    default:
      return (await import("./install-linux.js")).uninstall();
  }
}
