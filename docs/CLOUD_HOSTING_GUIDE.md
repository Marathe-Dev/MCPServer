# Cloud MCP Server: Local Testing, Free Hosting, and Connecting Agents

Companion to [docs/CLOUD_RELAY_PLAN.md](CLOUD_RELAY_PLAN.md). Covers running
[cloud-mcp-server](../cloud-mcp-server) locally, hosting it for free for development/testing,
connecting an MCP agent to it, and pointing a [local-tool-service](../local-tool-service) at
the hosted instance.

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

---

## 2. Host cloud-mcp-server for free (development/testing)

### What the host must support

This app needs a **long-running Node process** that can hold open a WebSocket connection
(`/device-link`) indefinitely and serve HTTP (`/mcp`) — it is **not** compatible
with pure serverless/functions platforms (Vercel, Netlify, Cloudflare Pages Functions, plain
AWS Lambda) because those don't keep a persistent process/connection alive between requests.
It already reads `PORT` from the environment and binds to `0.0.0.0` by default, which is
exactly what these hosts expect.

### Option A — Render.com (recommended, easiest free option)

1. Push this workspace (or at least the `cloud-mcp-server` folder) to a GitHub repository.
2. On [render.com](https://render.com), create a new **Web Service** and connect that repo.
3. Set:
   - **Root Directory**: `cloud-mcp-server`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `node build/index.js`
   - **Instance Type**: Free
4. Deploy. Render assigns a public URL like `https://your-app.onrender.com` and terminates
   TLS for you — no code changes needed, since the app already reads `PORT` and defaults to
   `0.0.0.0`.
5. **Free-tier caveat**: the instance spins down after ~15 minutes idle and wakes on the next
   incoming request (cold start, often 30–60s). Your `local-tool-service` will briefly
   disconnect while the instance sleeps and reconnect automatically once it wakes — hit the
   HTTPS URL once (or have an agent call it) to wake it before pairing a device.

### Option B — Glitch.com (fastest, no CLI)

1. On [glitch.com](https://glitch.com), create a new project from GitHub import, pointing at
   your repo (again set the working directory to `cloud-mcp-server` if it's a subfolder, or
   import a repo containing just that folder's contents at the root).
2. Set the `package.json` `start` script (already `node build/index.js`) and ensure a
   `build` step runs (Glitch runs `npm install` automatically; you may need to add
   `"postinstall": "npm run build"` to `package.json` since Glitch doesn't run a separate
   build command).
3. Glitch gives you `https://your-project.glitch.me` with free TLS. Free projects sleep
   after 5 minutes of inactivity and wake on the next request — same caveat as Render.

### Option C — Fly.io (more setup, more generous free allowance)

1. Install `flyctl`, run `fly launch` inside `cloud-mcp-server` (it will offer to generate a
   `Dockerfile` — accept, or supply one that runs `npm ci && npm run build` then
   `node build/index.js`).
2. `fly deploy`. Fly gives you `https://your-app.fly.dev` with free TLS and keeps a small VM
   running (no cold-start sleep the way Render/Glitch do, within the free allowance).

All three give you an `https://` hostname; the corresponding WebSocket endpoint is the same
host with `wss://` instead of `https://` (e.g. `wss://your-app.onrender.com/device-link`).

---

## 3. Connect a web agent or desktop agent to the hosted cloud MCP endpoint

Any MCP client that supports Streamable HTTP can connect directly. The URL is
`https://<your-host>/mcp` — **one universal endpoint for every agent and every device.**
Once connected, an agent first calls the `list_devices` tool to discover which `deviceId`s
are currently connected, then passes one as the `deviceName` argument on every other tool
call (e.g. "take a screenshot of local-test-device" →
`screenshot({ deviceName: "local-test-device" })`).

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

A web-based agent just needs to be told the same URL and issue standard MCP JSON-RPC calls
(`initialize`, `tools/list`, `tools/call`) against it — no special client library is required
beyond an MCP-compatible HTTP client.

---

## 4. Connect local-tool-service to the hosted cloud server

On the desktop you want to control, point `local-tool-service` at the hosted host instead of
`127.0.0.1`, using `wss://` (the WebSocket equivalent of the hosted `https://` URL):

```powershell
cd local-tool-service
$env:CLOUD_URL="wss://your-app.onrender.com"
$env:DEVICE_ID="local-test-device"   # this is the deviceName you'll pass in every tool call
npm start
```

No port forwarding or inbound firewall rule is needed on this machine — the connection is
always initiated outbound from `local-tool-service` to the cloud host. Watch this process's
logs for `connected to wss://your-app.onrender.com/device-link`, and the cloud host's logs
(Render/Glitch/Fly all provide a live log viewer) for `device registered: local-test-device`.

To run it automatically at login instead of a foreground terminal, use the install CLI
(see [local-tool-service/README.md](../local-tool-service/README.md)):

```powershell
node build/cli.js install
```

---

## 5. End-to-end smoke test

With both the hosted cloud server and a local-tool-service pointed at it running, call
`list_devices` (confirm `local-test-device` shows up) and then all 6 device tools with
`deviceName: "local-test-device"` from any MCP client against `https://<your-host>/mcp`
(Section 3's config works with any MCP Inspector-style tool, or a short script using
`@modelcontextprotocol/client`'s `StreamableHTTPClientTransport` against that URL). A
successful `screenshot` call with a real `width`/`height` and a real `get_window_list` count
confirms the full path — agent → hosted cloud server → WebSocket relay → local desktop — is
working.
