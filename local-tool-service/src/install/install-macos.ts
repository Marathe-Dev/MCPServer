import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const LABEL = "com.remotepc.localtoolservice";
const AGENTS_DIR = join(homedir(), "Library", "LaunchAgents");
const PLIST_PATH = join(AGENTS_DIR, `${LABEL}.plist`);

function gui(): string {
  return `gui/${process.getuid?.() ?? 0}`;
}

/**
 * Installs a per-user LaunchAgent (not a system LaunchDaemon), so it runs
 * inside the user's GUI session and can be granted Accessibility/Screen
 * Recording permissions.
 */
export function install(): void {
  const nodeExe = process.execPath;
  const cliPath = fileURLToPath(new URL("../cli.js", import.meta.url));

  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${nodeExe}</string>
    <string>${cliPath}</string>
    <string>start</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
</dict>
</plist>
`;
  mkdirSync(AGENTS_DIR, { recursive: true });
  writeFileSync(PLIST_PATH, plist);
  execFileSync("launchctl", ["bootstrap", gui(), PLIST_PATH]);
  console.log(`Installed LaunchAgent at ${PLIST_PATH}.`);
}

export function uninstall(): void {
  try {
    execFileSync("launchctl", ["bootout", gui(), PLIST_PATH]);
  } catch (error) {
    console.error(`LaunchAgent may already be unloaded: ${String(error)}`);
  }
  if (existsSync(PLIST_PATH)) unlinkSync(PLIST_PATH);
  console.log(`Removed LaunchAgent ${PLIST_PATH}.`);
}
