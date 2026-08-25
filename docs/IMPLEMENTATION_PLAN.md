# RemotePC MCP Service — Implementation Plan

## 1. Objective

Build a **TypeScript/Node.js MCP service for RemotePC** that lets MCP-compatible AI agents (Cline, Claude, etc.) control a desktop the same way HopToDesk's "AI Assistant & MCP" feature does.

Must support:

- **Local MCP connection** (stdio)
- **Remote MCP connection** (Streamable HTTP)
- MCP tools: `screenshot`, `mouse_click`, `mouse_move`, `type_text`, `key_press`
- Official MCP TypeScript SDK
- No authentication initially
- No OS-specific implementation initially
- Tool logic separated behind an abstraction/interface so OS-specific implementations can be added later without touching the MCP layer

> **Research correction:** the SDK really did split into a v2 line of separate packages — `@modelcontextprotocol/server` and `@modelcontextprotocol/client` (plus a thin `@modelcontextprotocol/node` middleware package for mounting Streamable HTTP on `node:http`) — confirmed against the SDK's own docs and npm at the time of writing (`@modelcontextprotocol/server@2.0.0`, `@modelcontextprotocol/node@2.0.0`, `zod@4.x`). v2 replaces the old monolithic `@modelcontextprotocol/sdk` (v1) used by most existing examples. This plan and the implementation both target v2.

---

## 2. Reference model: HopToDesk's "AI Assistant & MCP"

[hoptodesk.com/docs](https://www.hoptodesk.com/docs) → **AI Assistant & MCP** documents a production MCP integration this project mirrors:

- **What is MCP:** "a standard for AI agents to interact with external tools." HopToDesk exposes desktop control tools over an MCP server; the agent sends JSON-RPC 2.0 requests (`tools/call`) and the tools execute on the target device.
- **Two connection modes**, matching this plan's Phase 1 / Phase 2 exactly:
  - **Local** — agent and server on the same machine, direct localhost transport (HopToDesk: `ws://127.0.0.1:9333`; this project: stdio, the SDK's dedicated local-process transport).
  - **Remote** — agent connects through a relay/dashboard to reach any enrolled device (HopToDesk: `https://dashboard.hoptodesk.com/mcp`; this project: Streamable HTTP).
- **Available MCP tools** (HopToDesk's own catalog):

  | Tool | Description |
  | --- | --- |
  | `screenshot` | Capture the primary display as a PNG image |
  | `mouse_click` | Move mouse to coordinates and click (left, right, or double) |
  | `mouse_move` | Move mouse cursor to coordinates without clicking |
  | `type_text` | Type text input via the keyboard |
  | `key_press` | Press key combinations (e.g. Ctrl+S, Alt+Tab) |
  | `get_window_list` | List all visible windows with titles and positions |

  The first five are exactly the tools this project was asked to build. `get_window_list` is included as a bonus 6th tool, built the same way (interface → placeholder implementation), so this service's catalog matches HopToDesk's shape one-for-one.
- **Security model worth carrying forward for later phases:** local connections restricted to `127.0.0.1` only; remote connections require a scoped API key; all remote traffic over TLS; agent sessions isolated per key. None of this is implemented yet (explicitly out of scope for Phase 1/2 per the rules below), but the Streamable HTTP entrypoint already validates `Host`/`Origin` headers and binds to loopback by default, as a safe starting point.
- **Protocol reference:** HopToDesk's `/mcp` endpoint is "a stateless, spec-compliant MCP server" answering `initialize`, `tools/list`, `tools/call`, `prompts/list`, `prompts/get`, `ping` — the same verbs this project's SDK-based server answers automatically.

---

## 3. High-level architecture

```
                         ┌──────────────────┐
                         │    AI Agent      │
                         │      Cline       │
                         └────────┬─────────┘
                                  │
                       ┌──────────┴──────────┐
                       │                     │
                  LOCAL MCP             REMOTE MCP
                       │                     │
                    stdio              Streamable HTTP
                       │                     │
                       ▼                     ▼
              ┌────────────────────────────────────┐
              │       RemotePC MCP Server          │
              │         TypeScript / Node.js       │
              │                                    │
              │  MCP Tool Layer                    │
              │  screenshot · mouse_click ·        │
              │  mouse_move · type_text ·          │
              │  key_press · get_window_list       │
              │          │                         │
              │  Tool Abstraction Layer            │
              │  IScreenshotService · IMouseService│
              │  IKeyboardService · IWindowService │
              │          │                         │
              │  Placeholder Implementations       │
              └────────────────┬───────────────────┘
                               │
                         FUTURE ONLY
                               │
                               ▼
                  ┌────────────────────────┐
                  │ OS-Specific / Native   │
                  │ Tool Service           │
                  └────────────────────────┘
```

**Architectural rule:** the MCP layer must never know how Windows/Linux/macOS performs an operation. Tool handlers call only the `I*Service` interface; concrete implementations are swapped in behind [`service-factory.ts`](../src/services/service-factory.ts) via a `TOOL_BACKEND` setting.

---

## 4. Technology stack (as implemented)

| Concern | Choice |
| --- | --- |
| Language | TypeScript (strict mode) |
| Runtime | Node.js |
| MCP server SDK | `@modelcontextprotocol/server` v2 |
| MCP client SDK (tests only) | `@modelcontextprotocol/client` v2 |
| Node HTTP mounting | `@modelcontextprotocol/node` v2 (`toNodeHandler`, localhost Host/Origin guards) |
| Schema validation | `zod` (v4) |
| Native desktop automation | `@nut-tree-fork/nut-js` (mouse, keyboard, screen, window — Windows/macOS/Linux X11) |
| Screenshot PNG encoding | `pngjs` |
| Build | `tsc` |
| Testing | Node's built-in `node:test` + `node:assert`, driving a real in-process MCP `Client` against `createMcpHandler` |

---

## PHASE 1 — MCP tools + local (stdio) connection — ✅ Implemented

Deliverables, all present in this repository:

- TypeScript project (`src/`, `tests/`, `tsconfig.json`, `package.json`)
- Tool abstraction layer: `src/services/interfaces/*.ts`
- Placeholder implementations: `src/services/implementations/placeholder/*.ts`
- Six MCP tools registered on a shared `McpServer`: `src/tools/*.tool.ts` + `src/tools/index.ts`
- Local stdio transport: `src/server/local-server.ts` (via `serveStdio`)
- Unit/integration tests: `tests/tools/tools.test.ts` (discovery + every tool call, in-process, no OS access)
- No OS-specific code, no authentication

Cline (or any MCP host) launches `node build/index.js`, discovers all six tools, and calls each one, receiving a valid MCP response from the placeholder backend.

---

## PHASE 2 — Remote MCP connection — ✅ Implemented (scaffold)

Adds Streamable HTTP **without duplicating tool implementations**:

- `src/server/remote-server.ts` builds one `createMcpHandler(createServer)` and mounts it on plain `node:http` via `toNodeHandler`, guarded by `localhostHostValidation()` / `localhostOriginValidation()`.
- The same `createServer()` factory backs both transports — local and remote always expose identical tools and identical behavior.
- Endpoint: `http://127.0.0.1:3000/mcp` by default (`PORT` / `HOST` overridable).
- **No authentication** — explicitly out of scope, matching the rules below. (HopToDesk's own remote mode requires a scoped API key; that's the natural next step whenever auth is in scope.)

---

## PHASE 3 — Architecture hardening / real OS integration — ✅ Implemented

1. **Final abstraction realized** — `IMouseService`, `IKeyboardService`, `IScreenshotService`, `IWindowService` are now backed by `NutjsMouseService` / `NutjsKeyboardService` / `NutjsScreenshotService` / `NutjsWindowService` in `src/services/implementations/nutjs/`, all driven by the single cross-platform `@nut-tree-fork/nut-js` package (Windows/macOS/Linux X11) — no per-OS branching code, and no MCP tool changed.
2. **Dependency injection** — unchanged, via `service-factory.ts`; a tool never imports an OS API directly.
3. **Configuration** — `TOOL_BACKEND` now defaults to `"nutjs"` (real OS control); `"placeholder"` remains available as an explicit opt-in for deterministic, no-OS-access runs.
4. **Testing** — `tests/tools/tools.test.ts` now exercises the real `nutjs` backend end-to-end (physically drives the mouse/keyboard/screen on the machine running the tests).

---

## 5. Rules carried through the implementation

**MUST**

- TypeScript + Node.js ✅
- Official MCP TypeScript SDK (v2) ✅
- Tools implemented through SDK APIs (`server.registerTool`) ✅
- stdio local transport ✅
- Streamable HTTP remote transport ✅
- Tool logic independent of transport (shared `createServer()`) ✅
- Tool logic independent of OS (services are placeholders only) ✅
- Interfaces/abstractions for every machine operation ✅
- Placeholder/mock implementations ✅
- Local and remote transports share one tool registration ✅
- Unit tests ✅

**MUST NOT** *(Phase 1/2 scope; superseded by Phase 3 for OS implementation)*

- ~~❌ Windows/Linux/macOS API implementations~~ — now implemented in Phase 3 via `@nut-tree-fork/nut-js`
- ❌ C#/Rust service communication
- ❌ Authentication
- ❌ Docker requirement
- ❌ Duplicated tools for local vs. remote
- ❌ OS-specific code inside MCP tool handlers

All of the above are honored in the current codebase.
