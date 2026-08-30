export interface LocalToolServiceConfig {
    deviceId: string;
    cloudUrl: string;
}
/**
 * Loads DEVICE_ID/CLOUD_URL from the environment, falling back to a random
 * UUID persisted on first run (the only access-control mitigation given
 * "no auth" in v1 — treat it as a secret).
 */
export declare function loadConfig(): LocalToolServiceConfig;
