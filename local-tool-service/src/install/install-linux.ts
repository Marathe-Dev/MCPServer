import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const SERVICE_NAME = "local-tool-service.service";
const UNIT_DIR = join(homedir(), ".config", "systemd", "user");
const UNIT_PATH = join(UNIT_DIR, SERVICE_NAME);

/**
 * Installs a systemd **user** service (not a system service), so it
 * inherits the logged-in session's DISPLAY/X11 access.
 */
export function install(): void {
  const nodeExe = process.execPath;
  const cliPath = fileURLToPath(new URL("../cli.js", import.meta.url));

  const unit = `[Unit]
Description=Local Tool Service

[Service]
ExecStart=${nodeExe} ${cliPath} start
Restart=on-failure

[Install]
WantedBy=default.target
`;
  mkdirSync(UNIT_DIR, { recursive: true });
  writeFileSync(UNIT_PATH, unit);
  execFileSync("systemctl", ["--user", "daemon-reload"]);
  execFileSync("systemctl", ["--user", "enable", "--now", SERVICE_NAME]);
  console.log(`Installed and started systemd user service ${SERVICE_NAME}.`);
}

export function uninstall(): void {
  try {
    execFileSync("systemctl", ["--user", "disable", "--now", SERVICE_NAME]);
  } catch (error) {
    console.error(`Service may already be stopped: ${String(error)}`);
  }
  if (existsSync(UNIT_PATH)) unlinkSync(UNIT_PATH);
  try {
    execFileSync("systemctl", ["--user", "daemon-reload"]);
  } catch {
    // ignore — nothing left to reload
  }
  console.log(`Removed systemd user service ${SERVICE_NAME}.`);
}
