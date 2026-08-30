# local-mcp-server

A TypeScript/Node.js [Model Context Protocol](https://modelcontextprotocol.io) service that exposes RemotePC-style desktop-control tools to MCP-compatible AI agents (e.g. Cline). This is the local desktop server moved out of the repo root.

Implements all phases of the [implementation plan](docs/IMPLEMENTATION_PLAN.md): five required tools plus a bonus `get_window_list` tool (to match HopToDesk's published MCP catalog), a service abstraction layer, a real cross-platform backend (`@nut-tree-fork/nut-js`) plus a deterministic placeholder fallback, and both local stdio and remote Streamable HTTP transports.

## Architecture

```
MCP Tool (screenshot, mouse_click, mouse_move, type_text, key_press, get_window_list)
        │
        ▼
Service Interface (IScreenshotService, IMouseService, IKeyboardService, IWindowService)
        │
        ▼
nutjs implementation (default, real OS control)  ⇄  placeholder implementation (TOOL_BACKEND=placeholder)
```

Tool handlers never call an OS API directly — they only call the interface. The default `nutjs` backend implements the four `I*Service` interfaces via [`@nut-tree-fork/nut-js`](https://www.npmjs.com/package/@nut-tree-fork/nut-js), a single cross-platform (Windows/macOS/Linux X11) native automation package; a deterministic `placeholder` backend remains available via `TOOL_BACKEND=placeholder`. Swapping backends only requires wiring a new case into [`src/services/service-factory.ts`](src/services/service-factory.ts); no MCP tool code changes.

Both the local (stdio) and remote (Streamable HTTP) transports call the same [`createServer()`](src/server/create-server.ts) factory, so tool behavior never diverges between connection modes.

## Project layout

```
src/
  server/
    create-server.ts    Shared factory: builds McpServer + registers all tools
    local-server.ts      stdio transport entrypoint (local / Cline)
    remote-server.ts     Streamable HTTP transport entrypoint (remote)
  tools/                 One file per MCP tool; thin, calls services only
  services/
    interfaces/          I*Service abstractions (the contract MCP tools depend on)
    implementations/nutjs/        Real cross-platform implementations (@nut-tree-fork/nut-js)
    implementations/placeholder/   Deterministic mock implementations
    service-factory.ts   Picks a backend via TOOL_BACKEND env var (default: nutjs)
  models/                Shared request/result types
  index.ts               Entrypoint; picks stdio vs http via MCP_TRANSPORT
tests/tools/             In-process MCP client tests (node:test)
```

## Setup

```powershell
npm install
npm run build
```

Run those commands from the `local-mcp-server/` folder.

## Run locally (stdio) — e.g. with Cline

Point Cline (or any MCP host) at the built entrypoint:

```json
{
  "mcpServers": {
    "remotepc-mcp": {
      "command": "node",
      "args": ["D:\\MCP Server\\local-mcp-server\\build\\index.js"]
    }
  }
}
```

A ready-to-use `.vscode/mcp.json` is included for debugging inside VS Code.

## Run remotely (Streamable HTTP)

```powershell
npm run start:remote
```

Serves on `http://127.0.0.1:3000/mcp` (override with `PORT` / `HOST` env vars). No authentication is implemented yet — this is intentionally out of scope for Phase 2. Point any MCP client that supports Streamable HTTP at that URL, e.g.:

```json
{
  "mcpServers": {
    "remotepc-mcp": {
      "type": "http",
      "url": "http://127.0.0.1:3000/mcp"
    }
  }
}
```

## Tools

| Tool | Description | Arguments |
| --- | --- | --- |
| `screenshot` | Capture the primary display as a PNG image | _none_ |
| `mouse_click` | Move mouse to coordinates and click (left, right, or double) | `x`, `y`, `button` (`left`\|`right`), `clickType` (`single`\|`double`) |
| `mouse_move` | Move mouse cursor to coordinates without clicking | `x`, `y` |
| `type_text` | Type text input via the keyboard | `text` |
| `key_press` | Press key combinations (e.g. Ctrl+S, Alt+Tab) | `keys: string[]` |
| `get_window_list` | List all visible windows with titles and positions | _none_ |

All tools currently run against the `placeholder` backend (`TOOL_BACKEND=placeholder`, the default) and return deterministic mock data. No OS-specific code and no authentication are implemented yet, by design.

## Test

```powershell
npm test
```

Runs an in-process MCP `Client` against the real server (via `createMcpHandler`), verifying tool discovery and every tool call — no OS access, no network socket.
