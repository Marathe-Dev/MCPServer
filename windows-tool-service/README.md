# Windows MCP Tool Service

A Windows WPF (.NET Framework 4.5) desktop agent with x64 and Any CPU builds that lets an LLM control
this machine through the existing cloud MCP server: mouse, keyboard, screen
capture, window listing, and CMD execution (via WinPTY). It's a device agent
that dials out to the cloud server over WebSocket — not a standalone MCP
server itself, and no Node.js is required on the Windows machine.

```text
LLM -> cloud MCP server -> outbound WebSocket -> this WPF agent -> Win32 / WinPTY

```

This is a normal user-session EXE. No Windows service or installation scripts are included.

## Project layout

| File | Responsibility |
| --- | --- |
| [App.xaml](App.xaml), [App.xaml.cs](App.xaml.cs) | WPF startup, session guard, single instance per session, cleanup |
| [MainWindow.xaml](MainWindow.xaml), [MainWindow.xaml.cs](MainWindow.xaml.cs) | Designer-editable UI and connection event handlers (closing disconnects and exits) |
| `RelayClient.cs` | WebSocket connection to the cloud server: register, ping/pong, reconnect backoff |
| `DesktopTools.cs` | Single tool dispatcher — one `CallAsync` switch routes mouse/keyboard/screenshot/window input plus CMD and file reads |
| `WinPtyCommand.cs` | Runs one CMD command per call via WinPTY, with timeout and output limits |
| `FileTools.cs` | Reads a file (absolute path) as base64, capped at 10 MB |

## Requirements

- Windows 10/11 or Server (Desktop Experience). x64 is the validated deployment; Any CPU can also run on 32-bit Windows with matching x86 native dependencies (not yet runtime-tested).
- .NET Framework 4.5 targeting pack installed (reference assemblies under `Reference Assemblies\Microsoft\Framework\.NETFramework\v4.5`) — Visual Studio may prompt to install it on first open
- To build: Visual Studio with the ".NET desktop development" workload and full-framework MSBuild. Use a toolset with the legacy 4.5 reference assemblies available; current Visual Studio installers do not supply that targeting pack. Keep the target at v4.5.
- WinPTY 0.4.3 matching the process architecture (currently x64) — see [native/README.md](native/README.md) for one-time setup
- A signed-in, unlocked session — desktop actions and CMD don't work on the lock screen or a secure desktop

## Build and run

Open [WindowsToolService.sln](WindowsToolService.sln) in Visual Studio and build/run normally. From a Visual Studio Developer PowerShell at the repository root:

```powershell
msbuild windows-tool-service\WindowsToolService.sln /p:Configuration=Release /p:Platform=x64
& .\windows-tool-service\bin\Release\WindowsToolService.exe
```

Debug build and run (or select **Debug | x64** in Visual Studio and press F5):

```powershell
msbuild windows-tool-service\WindowsToolService.sln /p:Configuration=Debug /p:Platform=x64
& .\windows-tool-service\bin\Debug\WindowsToolService.exe
```

Any CPU build and run (use `Release` instead of `Debug` for an optimized build):

```powershell
msbuild windows-tool-service\WindowsToolService.sln /p:Configuration=Debug "/p:Platform=Any CPU"
& .\windows-tool-service\bin\AnyCPU\Debug\WindowsToolService.exe
```

Both platforms have Debug and Release configurations. Debug includes full symbols,
`DEBUG`/`TRACE`, and disables optimization. Any CPU has **Prefer 32-bit disabled**:
the EXE runs as 64-bit on 64-bit Windows and 32-bit on 32-bit Windows.

### Architecture dependencies

| Component | Architecture requirement |
| --- | --- |
| Managed agent, WPF, relay code | One Any CPU EXE can serve both; no separate C# build required |
| `winpty.dll` | Must match the running process: x64 or x86 |
| `winpty-agent.exe` | Distribute the matching WinPTY release and architecture pair |
| Visual C++ runtime, if required by WinPTY | Install the matching x64 or x86 redistributable |
| .NET Framework / Windows system DLLs | Installed by the OS/runtime; do not copy or rebuild them |

Builds currently copy the x64 WinPTY pair from `native` for both platform options.
For a 32-bit deployment, replace that pair **in the Any CPU deployment folder**
with the release's x86 pair. Keep the source `native` folder x64 for existing builds.
Rebuilding recopies the source pair; prepare the deployment folder after building.
Any CPU does not automatically select or bundle both native architectures. Without
matching native files, CMD fails even though the managed application can start.
Use x64 for the current tested deployment; validate Any CPU on a 32-bit machine
before distributing it there.

Distribute the whole `bin\Release` folder, not just the EXE — `winpty.dll` and `winpty-agent.exe` must sit alongside it.

[build.ps1](build.ps1) is optional and only builds/runs smoke tests using Visual Studio MSBuild (`-NativeTest` also exercises real WinPTY/WPF). It does not download dependencies and is not needed to build or run the app.

### Connecting

1. Enter the cloud base URL, e.g. `ws://127.0.0.1:4000` locally or `wss://relay.example.com` remotely (no `/device-link` suffix).
2. Pick a device name. A device ID is generated and saved on first connect.
3. Enable **Allow remote CMD execution** only if you trust the relay — it's off by default.
4. Optionally enable **Connect on startup** to connect whenever you launch the EXE.
5. Click **Connect**. The device then shows up in the cloud server's `list_devices`.

Settings live in `%LOCALAPPDATA%\WindowsMcpToolService\config.json` and can be overridden with `CLOUD_URL`, `DEVICE_ID`, `DEVICE_NAME` environment variables. Don't reuse the same device ID across machines or run two sessions for the same Windows user at once.

Closing the window disconnects and exits; launching again in the same session brings
the existing window forward. Click **Connect** to save settings. The old service-launch
preference is ignored: **Connect on startup** defaults to off until selected explicitly.
Existing device identity and CMD settings are retained.

## Existing Service Integration

Your own service can launch the EXE without arguments into the selected interactive
user's session and desktop, with that user's environment. Ordinary `Process.Start`
from Session 0 does not accomplish this; the agent rejects Session 0. Your service
owns launch/relaunch policy. Previously installed services are not automatically removed.

## Tools

| MCP tool | Relay action | Arguments |
| --- | --- | --- |
| `mouse_move` | `mouse.move` | `x`, `y` (virtual-desktop pixels) |
| `mouse_click` | `mouse.click` | `x`, `y`, `button` (left/right), `clickType` (single/double) |
| `type_text` | `keyboard.typeText` | `text` (up to 20,000 characters) |
| `key_press` | `keyboard.keyPress` | `keys`, e.g. `["ctrl", "s"]` |
| `screenshot` | `screenshot.capturePrimaryDisplay` | — (returns PNG `base64Data`, width, height) |
| `get_window_list` | `window.listWindows` | — (visible titled windows, geometry, focus) |
| `cmd` | `cmd.execute` | `command`, optional `workingDirectory`, `timeoutMs`, `maxOutputChars` |
| `get_file` | `file.read` | `path` (absolute); returns `base64Data`, `name`, `size` — files over 10 MB are rejected |

Every relay action is dispatched by one `DesktopTools.CallAsync` switch. Results carry `success`, `backend` (`win32` or `winpty`), and an ISO `timestamp`. Key/mouse-button names match the existing TypeScript agent. The cloud server needs its own small rebuild to pick up the `cmd` and `get_file` tools:

```powershell
npm --prefix cloud-mcp-server run build
npm --prefix cloud-mcp-server start
```

Older TypeScript-based device agents still work for the original six tools; they just reject `cmd` as unsupported.

### Using `cmd`

```json
{
  "deviceId": "deviceId returned by list_devices",
  "command": "ver & whoami & dir",
  "workingDirectory": "C:\\Users",
  "timeoutMs": 10000,
  "maxOutputChars": 65536
}
```

Each call spawns a fresh `cmd.exe /d /s /c` under WinPTY (defaults: 10s timeout, capped at 20s; 65,536 output characters, configurable up to 1,048,576). The result includes `output`, `exitCode`, `timedOut`, `truncated`, `durationMs`; a nonzero exit code or timeout is surfaced as an MCP error with the partial result still attached.

Only a single command line is accepted (use `&`/`&&` to chain); there's no interactive stdin, so don't use it for prompts, REPLs, or long-running servers. Output is raw terminal text and may contain ANSI escapes. On timeout or disconnect the WinPTY session is torn down, which kills console-attached children — but detached processes (e.g. from `start`) can outlive it.

## Security notes

- **The cloud relay has no authentication.** Put `/mcp`, `/device-link`, and the dashboard behind a VPN or an authenticated gateway before using this beyond localhost.
- Use `wss://` for anything off-loopback; `ws://` is accepted only for loopback addresses.
- CMD and the desktop tools both grant full control as the signed-in user — only enable CMD for a relay you trust, and never run the agent elevated.
- Tool arguments/output may be logged by the cloud server — don't pass secrets through them.
- One tool call runs at a time per device; concurrent calls get a "busy" error instead of queuing.

## Testing

```powershell
.\windows-tool-service\build.ps1              # headless unit-style checks
.\windows-tool-service\build.ps1 -Configuration Debug -Platform AnyCPU
.\windows-tool-service\build.ps1 -NativeTest  # + real WinPTY/WPF checks (needs an unlocked desktop)
node --test windows-tool-service\tests\relay.test.mjs   # live C# client vs. a real WebSocket
npm --prefix cloud-mcp-server test            # cloud relay + MCP tool tests
```

Not covered by automated tests: Visual Studio designer interaction, integration with your service, multi-user RDP, and physical keyboard/mouse input.
