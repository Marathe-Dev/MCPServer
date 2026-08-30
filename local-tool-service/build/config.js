import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
const CONFIG_DIR = join(homedir(), ".local-tool-service");
const CONFIG_PATH = join(CONFIG_DIR, "config.json");
/**
 * Loads DEVICE_ID/CLOUD_URL from the environment, falling back to a random
 * UUID persisted on first run (the only access-control mitigation given
 * "no auth" in v1 — treat it as a secret).
 */
export function loadConfig() {
    const cloudUrl = process.env.CLOUD_URL ?? "ws://127.0.0.1:4000";
    const deviceId = process.env.DEVICE_ID ?? loadOrCreatePersistedDeviceId();
    return { deviceId, cloudUrl };
}
function loadOrCreatePersistedDeviceId() {
    if (existsSync(CONFIG_PATH)) {
        const config = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
        if (config.deviceId)
            return config.deviceId;
    }
    const deviceId = randomUUID();
    mkdirSync(CONFIG_DIR, { recursive: true });
    writeFileSync(CONFIG_PATH, JSON.stringify({ deviceId }, null, 2));
    return deviceId;
}
