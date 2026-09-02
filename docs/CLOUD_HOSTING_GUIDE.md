# Cloud MCP Server: Local Testing, Render Hosting, and Connecting Agents

Companion to [docs/CLOUD_RELAY_PLAN.md](CLOUD_RELAY_PLAN.md). This guide shows how to run
[cloud-mcp-server](../cloud-mcp-server) locally for testing, host it on Render.com, connect
AI agents to the public MCP endpoint, and start [local-tool-service](../local-tool-service)
on each desktop.

> ⚠️ **No auth in v1.** The hosted URL + `deviceId` pair is effectively a shared secret —
> anyone who has both can fully control the paired desktop. Only use free/public hosting
> for development and testing, never for a real desktop you care about, until real
> authentication is added (see the "Auth" decision in [CLOUD_RELAY_PLAN.md](CLOUD_RELAY_PLAN.md)).

> **Note on live info:** hosting providers change their free-tier limits and dashboards
> often. The steps below reflect each provider's general, stable workflow — double-check
> current limits/UI on the provider's own site before relying on them.

---

## 1. Run cloud-mcp-server locally for testing

```powershell
cd cloud-mcp-server
npm install
npm run build
$env:PORT=4000       # optional, default 4000
$env:HOST="127.0.0.1" # optional, default 0.0.0.0 (use 127.0.0.1 for local-only testing)
npm start
```

You should see:

```
[cloud-mcp-server] MCP endpoint: http://127.0.0.1:4000/mcp (use the "deviceName" argument on every tool)
[cloud-mcp-server] device link endpoint: ws://127.0.0.1:4000/device-link
```

Run a [local-tool-service](../local-tool-service) against it in another terminal to have a
real device to route calls to:

```powershell
cd local-tool-service
npm install
npm run build
$env:CLOUD_URL="ws://127.0.0.1:4000"
$env:DEVICE_ID="local-test-device"
npm start
```

Watch the cloud server's terminal for `device registered: local-test-device` — that
confirms the relay is connected end to end. Automated, OS-independent tests also exist:
`cd cloud-mcp-server; npm test`.

Test using MCP Inspector : `npx @modelcontextprotocol/inspector`

---

## 2. Host cloud-mcp-server on Render.com

Render.com is the simplest option here because it runs a long-lived Node process and gives
you a public HTTPS endpoint automatically.

1. Push this workspace to GitHub.
2. In Render, create a new **Web Service** and connect the repo.
3. Set **Root Directory** to `cloud-mcp-server`.
4. Use **Build Command**: `npm install && npm run build`.
5. Use **Start Command**: `node build/index.js`.
6. Deploy and copy the public URL, for example `https://your-app.onrender.com`.

Render gives you the HTTP MCP endpoint at:

```text
https://your-app.onrender.com/mcp
```

and the WebSocket relay endpoint at:

```text
wss://your-app.onrender.com/device-link
```

For local testing, the same project can still be started from the `cloud-mcp-server` folder
with `npm install`, `npm run build`, and `npm start`.

---

## 3. Connect AI agents to the hosted endpoint

Any MCP client that supports Streamable HTTP can connect to the same public URL:

```text
https://your-app.onrender.com/mcp
```

This is the one universal endpoint for all agents and all devices. After connecting, the
agent should call `list_devices` first, then pass the selected `deviceName` on each desktop
tool call.

**VS Code (`.vscode/mcp.json`) or similar host:**

```json
{
  "servers": {
    "remotepc-cloud": {
      "type": "http",
      "url": "https://your-app.onrender.com/mcp"
    }
  }
}
```

**Generic MCP host config (Claude Desktop-style / other agents):**

```json
{
  "mcpServers": {
    "remotepc-cloud": {
      "type": "http",
      "url": "https://your-app.onrender.com/mcp"
    }
  }
}
```

The agent only needs the URL above and standard MCP calls like `initialize`, `tools/list`,
and `tools/call`.

---

## 4. Start local-tool-service on each desktop

On each desktop you want to control, start `local-tool-service` and point it at the Render
relay endpoint:

```powershell
cd local-tool-service
npm install
npm run build
$env:CLOUD_URL="wss://your-app.onrender.com"
$env:DEVICE_ID="local-test-device"
npm start
```

No port forwarding is needed. The desktop service connects outward to the cloud server.
Watch for `connected to wss://your-app.onrender.com/device-link` in the local logs and
`device registered: local-test-device` in Render logs.

To run it automatically at login instead of a foreground terminal, use the install CLI
(see [local-tool-service/README.md](../local-tool-service/README.md)):

```powershell
node build/cli.js install
```

---

## 5. Quick smoke test

1. Start `cloud-mcp-server` locally or deploy it to Render.
2. Start `local-tool-service` on the desktop.
3. Call `list_devices` from the agent and confirm the device appears.
4. Call `screenshot`, `mouse_move`, `mouse_click`, `type_text`, `key_press`, or
   `get_window_list` with `deviceName` set to that device.

If those calls work, the full path is working: agent → cloud MCP server → relay → local
desktop.
