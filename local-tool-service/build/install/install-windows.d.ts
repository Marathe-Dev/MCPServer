/**
 * Installs a Scheduled Task that runs at logon, in the current user's
 * interactive session (not elevated), so it has access to the desktop —
 * unlike a classic Session-0 Windows Service. Launched hidden via a small
 * VBScript shim so no console window appears.
 */
export declare function install(): void;
export declare function uninstall(): void;
