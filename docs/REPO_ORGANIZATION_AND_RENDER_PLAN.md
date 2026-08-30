# Repo Organization and Render Plan

This workspace already fits a monorepo structure, and that is the simplest path for your current setup.

## Recommendation

Keep one GitHub repository for now, with the three projects as folders:

- `cloud-mcp-server/` for the hosted MCP endpoint
- `local-tool-service/` for the desktop-side relay client
- the existing root project only if you still want to keep the older single-machine MCP code around

Why this is the best fit now:

- You only need one GitHub repo link to share.
- Render can deploy only the cloud folder by setting its root directory.
- The local tool service does not need deployment; it runs on the controlled desktop.
- You can still split into separate repos later if you want independent release cycles.

If you want the cleanest public-facing repo, I would make the root repo name something like `remote-mcp-suite`, then keep the cloud and local services inside it as subfolders.

## Render setup for `cloud-mcp-server`

Render does not need a special host setting from you. The app already does the right thing:

- reads `PORT` from the environment
- defaults `PORT` to `4000` locally
- binds to `0.0.0.0` by default through `HOST`

On Render, the platform assigns the port, so the server should listen on `process.env.PORT`. That is already how `cloud-mcp-server/src/index.ts` works.

Use these settings in Render:

- **Root Directory**: `cloud-mcp-server`
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm start`
- **Instance Type**: free tier for testing

You do not manually set the public host URL. Render gives you one, and the service listens on the port Render injects.

## How the local tool service connects

The local service connects out to the cloud server over WebSocket. It does not need inbound ports, port forwarding, or router changes.

Use the hosted URL like this on the desktop machine:

```powershell
cd local-tool-service
$env:CLOUD_URL="wss://your-app.onrender.com"
$env:DEVICE_ID="my-desktop-1"
npm start
```

That means:

- the cloud server is reachable at `https://your-app.onrender.com/mcp`
- the device relay socket is `wss://your-app.onrender.com/device-link`
- the local service dials out to the cloud server and stays connected

## Practical plan

1. Put the whole workspace into one GitHub repository.
2. Deploy only `cloud-mcp-server/` to Render as the public service.
3. Run `local-tool-service/` on each desktop you want to control.
4. Point each local service at the Render URL with `CLOUD_URL`.
5. Use the universal `/mcp` endpoint from agents, and select the target desktop with `deviceName`.

## When to split repos later

Split only if you actually need separate ownership or release cadence.

For example:

- keep `cloud-mcp-server` public
- keep `local-tool-service` private
- or publish them independently

If your main goal is just to get Render working and connect local desktops, splitting now adds extra work without giving you a real advantage.