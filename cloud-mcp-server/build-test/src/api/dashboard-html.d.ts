/**
 * Inlines the same dashboard/index.html + styles.css + app.js served at
 * /dashboard into one self-contained HTML document, so MCP clients that
 * render HTML/resource content (the "desktop agent widget") don't need a
 * second HTTP round-trip to fetch this server's static files. `publicUrl`
 * is injected so the embedded app.js still talks to the right REST API.
 */
export declare function buildDashboardHtml(publicUrl: string): string;
