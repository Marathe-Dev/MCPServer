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
