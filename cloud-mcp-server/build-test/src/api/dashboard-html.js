import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
/** `dashboard/` lives two levels above this compiled file (build/api/ -> build/ -> project root). */
const DASHBOARD_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "dashboard");
const ICONS_CDN = '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@2.47.0/tabler-icons.min.css" />';
/**
 * Inlines the same dashboard/index.html + styles.css + app.js served at
 * /dashboard into one self-contained HTML document, so MCP clients that
 * render HTML/resource content (the "desktop agent widget") don't need a
 * second HTTP round-trip to fetch this server's static files. `publicUrl`
 * is injected so the embedded app.js still talks to the right REST API.
 */
export function buildDashboardHtml(publicUrl) {
    const html = readFileSync(join(DASHBOARD_DIR, "index.html"), "utf8");
    const css = readFileSync(join(DASHBOARD_DIR, "styles.css"), "utf8");
    const js = readFileSync(join(DASHBOARD_DIR, "app.js"), "utf8");
    const bodyMatch = html.match(/<body>([\s\S]*)<\/body>/);
    const bodyContent = (bodyMatch ? bodyMatch[1] : html).replace(/<script src="app\.js"><\/script>\s*/, "");
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>RemotePC Control Dashboard</title>
${ICONS_CDN}
<style>${css}</style>
</head>
<body>
${bodyContent}
<script>window.__DASHBOARD_API_BASE__ = ${JSON.stringify(publicUrl)};</script>
<script>${js}</script>
</body>
</html>`;
}
