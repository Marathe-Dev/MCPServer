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
- `ws://<host>:<port>/device-link` — WebSocket endpoint a local-tool-service connects to.
- `http://<host>:<port>/dashboard` — web dashboard UI (Option A, see below).
- `http://<host>:<port>/api/*` — REST API consumed by the dashboard (Option A) and the
  `show_dashboard` MCP tool's HTML widget (Option B).

## Dashboard (Option A — web) and `show_dashboard` tool (Option B — desktop agent widget)

Two ways to view/control connected devices without an MCP client typing raw tool calls:

- **Web dashboard**: open `http://<host>:<port>/dashboard` in a browser. Plain HTML/CSS/JS
  (no build step), served as static files from [dashboard/](dashboard/). Shows device cards
  (name, OS, status), Quick Actions (List Devices, Screenshot All, Type Text, Click), and a
  System Monitor table. Polls `GET /api/devices` every 30s — no WebSocket push.
- **`show_dashboard` MCP tool**: callable from any MCP client. Returns two content blocks so
  it degrades gracefully:
  1. A Markdown summary table + a link to the full web dashboard — renders in every client,
     including chat UIs with no HTML support (e.g. VS Code Copilot Chat).
  2. An embedded `text/html` resource containing the *same* dashboard UI inlined as one
     self-contained document — rendered inline by MCP clients that support HTML/resource
     content (e.g. Claude.ai/Claude Desktop artifacts).

  Set `PUBLIC_URL` (e.g. `https://your-domain.example`) so the widget's "Open full
  dashboard" link and embedded API calls point somewhere reachable; it otherwise falls back
  to `http://<HOST>:<PORT>` (with `0.0.0.0` normalized to `localhost`).

### REST API

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
