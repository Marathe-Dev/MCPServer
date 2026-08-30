/**
 * Installs a systemd **user** service (not a system service), so it
 * inherits the logged-in session's DISPLAY/X11 access.
 */
export declare function install(): void;
export declare function uninstall(): void;
