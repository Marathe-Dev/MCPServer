# local-tool-service

Runs on the controlled desktop. Connects **outbound** to a
[cloud-mcp-server](../cloud-mcp-server) over WebSocket (NAT/firewall-friendly), registers a
`deviceId`, and executes real mouse/keyboard/screen/window tool calls via
[`@nut-tree-fork/nut-js`](https://www.npmjs.com/package/@nut-tree-fork/nut-js) — the same
cross-platform backend used by the single-machine project in this workspace.

> ⚠️ **No authentication in v1.** Your `deviceId` is effectively a bearer secret — anyone who
> knows it can control this desktop through the paired cloud server. Don't share it outside
> your intended agent(s)/user. See [docs/CLOUD_RELAY_PLAN.md](../docs/CLOUD_RELAY_PLAN.md).

## Setup

```powershell
npm install
npm run build
```

## Configuration

| Env var | Default | Notes |
| --- | --- | --- |
| `CLOUD_URL` | `ws://127.0.0.1:4000` | Base URL of the cloud-mcp-server (`/device-link` is appended automatically) |
| `DEVICE_ID` | random UUID, persisted to `~/.local-tool-service/config.json` on first run | Share this with the agent(s) that should control this desktop |
| `NO_TRAY` | unset | Set to `1` to skip the system tray icon (headless) |

## Run in the foreground (for testing)

```powershell
npm start
```

## Install as a per-user autostart process

Not a classic Windows Service / launchd daemon / systemd system service — those run outside
the interactive desktop session and can't see/control the logged-in user's mouse, keyboard,
or screen. Instead, this installs a **per-user, login-time autostart**:

```powershell
node build/cli.js install     # Windows: Scheduled Task (at logon) · macOS: LaunchAgent · Linux: systemd --user service
node build/cli.js uninstall   # removes it again
```

A system tray icon (status, device id, quit) appears once `assets/icon.ico` (Windows) or
`assets/icon.png` (macOS/Linux) is added to this project — it runs headless without those
files.

## Platform prerequisites

- **Windows**: none extra.
- **macOS**: grant the running process both **Accessibility** and **Screen Recording**
  permissions.
- **Linux**: requires `libxtst-dev` and an X11 session — Wayland is not supported.
