import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const TASK_NAME = "LocalToolService";
const CONFIG_DIR = join(homedir(), ".local-tool-service");
const VBS_PATH = join(CONFIG_DIR, "launch-hidden.vbs");

/**
 * Installs a Scheduled Task that runs at logon, in the current user's
 * interactive session (not elevated), so it has access to the desktop —
 * unlike a classic Session-0 Windows Service. Launched hidden via a small
 * VBScript shim so no console window appears.
 */
export function install(): void {
  const nodeExe = process.execPath;
  const cliPath = fileURLToPath(new URL("../cli.js", import.meta.url));

  mkdirSync(CONFIG_DIR, { recursive: true });
  const vbs = `Set shell = CreateObject("WScript.Shell")\r\nshell.Run """${nodeExe}"" ""${cliPath}"" start", 0, False\r\n`;
  writeFileSync(VBS_PATH, vbs);

  execFileSync("schtasks", [
    "/create",
    "/tn",
    TASK_NAME,
    "/tr",
    `wscript.exe //B "${VBS_PATH}"`,
    "/sc",
    "onlogon",
    "/rl",
    "limited",
    "/f",
  ]);
  console.log(`Installed scheduled task "${TASK_NAME}" (runs hidden at logon).`);
}

export function uninstall(): void {
  try {
    execFileSync("schtasks", ["/delete", "/tn", TASK_NAME, "/f"]);
  } catch (error) {
    console.error(`Task "${TASK_NAME}" may already be removed: ${String(error)}`);
  }
  if (existsSync(VBS_PATH)) unlinkSync(VBS_PATH);
  console.log(`Removed scheduled task "${TASK_NAME}".`);
}
