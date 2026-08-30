/**
 * Installs a per-user LaunchAgent (not a system LaunchDaemon), so it runs
 * inside the user's GUI session and can be granted Accessibility/Screen
 * Recording permissions.
 */
export declare function install(): void;
export declare function uninstall(): void;
