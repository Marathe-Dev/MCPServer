# cloud-mcp-server

Internet-facing MCP server. Speaks real MCP (Streamable HTTP) to web/desktop agents at one
universal `/mcp` endpoint — every tool takes a `deviceName` argument, so one agent
connection can control any number of paired desktops. Relays each call over a WebSocket to
the matching connected [local-tool-service](../local-tool-service) instance.

> ⚠️ **No authentication in v1.** Anyone who knows/guesses a `deviceId` can send tool calls
> (full mouse/keyboard/screen control) to that desktop through this server. Treat `deviceId`
> as an unguessable secret (a random UUID v4) and do not expose this server publicly without
> adding real auth first. See [docs/CLOUD_RELAY_PLAN.md](../docs/CLOUD_RELAY_PLAN.md).

## Setup

```powershell
npm install
npm run build
```

## Run

```powershell
$env:PORT=4000        # optional, default 4000
$env:HOST="0.0.0.0"   # optional, default 0.0.0.0
npm start
```

This exposes:
- `http://<host>:<port>/mcp` — one universal MCP endpoint; every tool call names its
  target device via a `deviceName` argument (see `list_devices` to discover connected ones).
  This is also where the interactive in-agent dashboard comes from (`show_dashboard` tool).
- `ws://<host>:<port>/device-link` — WebSocket endpoint a local-tool-service connects to.
- `http://<host>:<port>/dashboard` — optional standalone web dashboard UI (Option A, below).
- `http://<host>:<port>/api/*` — REST API used by the standalone web dashboard (Option A).

## Dashboard — two ways to see it

Both front-ends read the **same** device registry and drive the **same** relay path to
devices. Pick whichever fits.

### Option B (primary) — interactive dashboard inside the agent (`show_dashboard` tool)

This is the main path and needs **no browser**. It uses the **MCP Apps** standard
([SEP-1865](https://github.com/modelcontextprotocol/ext-apps), extension
`io.modelcontextprotocol/ui`), which hosts like **Claude**, VS Code, Goose, Postman, and
MCPJam render inline as an interactive widget.

When the user asks something like "show me the connected devices dashboard", the agent calls
`show_dashboard`. Three pieces make it interactive:

  1. **A registered UI resource** — `ui://remotepc-dashboard`, served via `resources/read`
     with MIME type `text/html;profile=mcp-app`. It's a self-contained widget (inline CSS +
     inline SVG, no CDNs) that the host renders in a sandboxed iframe.
  2. **Tool→UI linkage** — the `show_dashboard` tool declares `_meta.ui.resourceUri`, so the
     host knows which resource to render. The tool also returns a Markdown summary (text
     fallback) plus the device list as `structuredContent`.
  3. **Interactivity over JSON-RPC** — the widget acts as a tiny MCP client over
     `postMessage`: it does the `ui/initialize` handshake, receives live device data via
     `ui/notifications/tool-result` and the app-only `get_dashboard_data` tool, and every
     button issues a standard `tools/call` (`screenshot`, `type_text`, `mouse_click`,
     `get_window_list`) that the host proxies back to this server. Results (e.g. the
     screenshot PNG) render inline in the widget.

  Hosts **without** MCP Apps support ignore `_meta.ui` / the `ui://` resource and simply
  show the `show_dashboard` Markdown table — graceful degradation, per the spec. Set
  `PUBLIC_URL` so any absolute links resolve; it otherwise falls back to
  `http://<HOST>:<PORT>` (`0.0.0.0` → `localhost`).

### Option A (optional) — standalone web dashboard

Open `http://<host>:<port>/dashboard` in a browser. Plain HTML/CSS/JS (no build step),
served as static files from [dashboard/](dashboard/). Shows device cards (name, OS, status),
Quick Actions (List Devices, Screenshot All, Type Text, Click), and a System Monitor table.
Polls `GET /api/devices` every 30s and calls the REST API below on button clicks.

### REST API (backs Option A)

| Method & Path | Body | Description |
| --- | --- | --- |
| `GET /api/devices` | — | List every device seen this process lifetime, with `deviceName`, `platform`, `status` (`online`/`offline`), `lastActive`. |
| `GET /api/device-status/:deviceId` | — | Single device's metadata, 404 if unknown. |
| `POST /api/action` | `{ deviceId, action, args }` (`action`: `screenshot"\|"mouse_move"\|"mouse_click"\|"type_text"\|"key_press"\|"get_window_list"`) | Relays one action to a device via the same services the MCP tools use. |
| `POST /api/refresh` | — | Returns the current device list (state is already live; this exists for explicit "refresh" UX). |

> ⚠️ **`/api/*` has no authentication**, matching this project's v1 posture (see the
> warning above) — anyone who can reach this server can trigger screenshot/click/type
> actions on any registered desktop. Add auth before exposing this server beyond localhost
> or a trusted network.

Device metadata (`deviceName`/`platform`) comes from local-tool-service's `register`
message and is only as fresh as that connection — devices are kept in the registry (marked
`"offline"`) after disconnect rather than deleted, so the dashboard/System Monitor can show
history for the life of this process; it's cleared on server restart (no persistence/DB).

The dashboard has no "Files" browsing action — there's no backing service for it anywhere
in this codebase, so its button is present but disabled.

## Test

```powershell
npm test
```

Runs the in-process relay-level tests (`tests/relay/relay.test.ts`) against a fake
WebSocket "local service" — no OS access, no real device required.

## Connecting an agent

Point any MCP client (Streamable HTTP) at `http://<host>:<port>/mcp` — a single, universal
endpoint for every agent. Call `list_devices` to see which `deviceId`s are currently
connected, then pass one as the `deviceName` argument on every other tool call (e.g.
`screenshot({ deviceName: "local-test-device" })`).
