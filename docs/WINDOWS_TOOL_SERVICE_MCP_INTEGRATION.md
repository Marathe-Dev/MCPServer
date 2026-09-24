# Windows Tool Service — MCP Server Integration Guide

**Audience:** Backend team adding the Windows desktop-control tools to the production MCP server.
**Scope:** What `windows-tool-service` provides, and exactly what the MCP server must send/expect when routing tool calls to it through the broker and RPCService.

---

## 1. Where this fits in the production flow

```
MCP Server → RemotePC Broker → RPCService (on target Windows machine) → windows-tool-service → result back
                                                                        ↓
MCP Server ← RemotePC Broker ← RPCService  ←───────────────────────────┘
```

- **MCP Server** (your side): exposes AI-facing tools, decides which machine to target, sends a `MESSAGE_TO` to the broker.
- **Broker**: routes the message to the correct machine/user session — no changes needed there for this integration.
- **RPCService** (C++, runs locally on the target Windows machine): receives the `MESSAGE_TO`, recognizes `message_details.src == "MCP"`, and forwards it to `windows-tool-service` over a local named pipe. It also translates the reply back into a `MESSAGE_TO` response for the broker. **This translation is RPCService's job, not the MCP server's** — the MCP server only needs to produce the `message_details` shape below.
- **windows-tool-service** (this project, WPF agent running as the signed-in user): executes the actual tool (mouse, keyboard, screenshot, CMD, file read) and returns a result.

**Key point:** there is no `deviceId` concept inside `windows-tool-service` in this flow. Machine targeting is entirely the broker's job via `to_machine_id`/`to_username`. Once RPCService hands a call to `windows-tool-service` over the local pipe, it's understood to be for *that* machine only.

---

## 2. Message envelope you must send

This is the exact shape the MCP server sends to the broker for every one of our tools (as already agreed):

```json
{
  "requestId": "5d1805de-e17e-437f-bfee-0f5731162696",
  "message_type": "MESSAGE_TO",
  "to_machine_id": "C4C6E62A503B",
  "to_username": "eAHk7VDH8x",
  "message_details": {
    "type": "cmd.execute",
    "requestId": "5d1805de-e17e-437f-bfee-0f5731162696",
    "hostdesc": "SIRISHA-DAVRC",
    "rtype": "1",
    "viewer_pt": "eAHk7VDH8x",
    "src": "MCP",
    "args": {
      "command": "whoami && hostname",
      "timeoutMs": 10000,
      "maxOutputChars": 65536
    }
  }
}
```

Fields the MCP server controls per call:

| Field | Value |
|---|---|
| `message_details.src` | Always `"MCP"` — this is what tells RPCService to divert the call to `windows-tool-service`. |
| `message_details.type` | One of the **exact tool identifiers** in the catalog below (§4). Case-sensitive, must match verbatim. |
| `message_details.args` | The tool's argument object — schema is per-tool, given below. Must match field names/types exactly; `windows-tool-service` validates strictly and rejects unknown/malformed shapes. |
| `message_details.requestId` / top-level `requestId` | Your own correlation ID; returned unchanged in the response so you can match it back to the waiting caller. |

The response you'll get back (via the broker, after RPCService translates it) carries the result of:

```json
{ "type": "tool_result", "requestId": "<same id>", "ok": true, "result": { ... tool-specific ... } }
```

or on failure:

```json
{ "type": "tool_result", "requestId": "<same id>", "ok": false, "error": "human-readable message" }
```

Treat `ok: false` as a tool-level failure (bad args, disabled feature, locked desktop, busy, etc.) — not a transport error. Surface `error` to whatever called the MCP tool.

---

## 3. Correlation, concurrency, and timeouts

- **One tool runs at a time per machine.** If a second call arrives while one is still running, `windows-tool-service` immediately replies `ok:false, error:"Agent busy; retry after the current action completes."` — there is no queueing. Retry after a short delay if you see this.
- **Recommended per-tool timeouts** for how long the MCP server should wait for a `tool_result` before giving up (matches what the existing cloud relay already uses):

| Tool | Recommended timeout |
|---|---|
| `cmd.execute` | 30,000 ms (caller's own `timeoutMs` arg caps execution at 20,000 ms; leave headroom for I/O) |
| `screenshot.capture` | 60,000 ms (capture + encoding of large frames) |
| `file.read` | 30,000 ms (upload for larger files) |
| everything else (mouse/keyboard/window) | 15,000 ms |

- If the machine's `windows-tool-service` isn't connected to RPCService at all (pipe down), RPCService should surface that as its own transport-level error to the broker — that's outside `windows-tool-service`'s contract.

---

## 4. Tool catalog — exact identifiers, args, and results

Every table below is the **authoritative wire contract**. `args` must be sent exactly as shown; `result` is exactly what comes back inside `tool_result.result`. All results also include a common envelope: `success` (bool), `backend` (string, e.g. `"win32"`/`"winpty"`), `timestamp` (ISO-8601 UTC) — omitted from the tables below for brevity, but always present.

### 4.1 `mouse.move`
Move the cursor.

| args | type | required | notes |
|---|---|---|---|
| `x` | integer | yes | virtual-desktop pixel |
| `y` | integer | yes | virtual-desktop pixel |

**result:** `{ x, y }`

### 4.2 `mouse.click`
Move the cursor and click.

| args | type | required | notes |
|---|---|---|---|
| `x` | integer | yes | virtual-desktop pixel |
| `y` | integer | yes | virtual-desktop pixel |
| `button` | `"left"` \| `"right"` | no | default `"left"` |
| `clickType` | `"single"` \| `"double"` | no | default `"single"` |

**result:** `{ x, y }`

### 4.3 `mouse.scroll`
Scroll the wheel, optionally after moving to a point first.

| args | type | required | notes |
|---|---|---|---|
| `amount` | integer, -100..100 | yes | notches; positive = up/right |
| `axis` | `"vertical"` \| `"horizontal"` | no | default `"vertical"` |
| `x`, `y` | integer | no | move here before scrolling |

**result:** `{ amount, axis }`

### 4.4 `mouse.drag`
Press a button at one point, move to another, release.

| args | type | required | notes |
|---|---|---|---|
| `x`, `y` | integer | yes | drag start |
| `toX`, `toY` | integer | yes | drag end |
| `button` | `"left"` \| `"right"` | no | default `"left"` |

**result:** `{ x, y, toX, toY }`

### 4.5 `keyboard.typeText`
Type literal Unicode text.

| args | type | required | notes |
|---|---|---|---|
| `text` | string, ≤20,000 chars | yes | typed as key-down/up pairs per character |

**result:** *(envelope only)*

### 4.6 `keyboard.keyPress`
Press a key combination together (e.g. Ctrl+S), then release in reverse order.

| args | type | required | notes |
|---|---|---|---|
| `keys` | array of strings, 1–16 items | yes | e.g. `["ctrl", "s"]`. Accepts letters, digits, F1–F24, and aliases (`ctrl`/`alt`/`shift`/`win`, `enter`, `esc`, `tab`, `space`, `backspace`, `delete`, arrows, `home`/`end`/`pageup`/`pagedown`, punctuation) |

**result:** *(envelope only)*

### 4.7 `screenshot.capture`
Capture a screen region. The image is returned **inline as base64** (`base64Data`) — no storage or upload is involved. The agent is Per-Monitor-V2 DPI aware, so this pixel space always matches `mouse.move`/`mouse.click` input coordinates exactly, including across monitors with different scale factors.

| args | type | required | notes |
|---|---|---|---|
| `target` | `"primary"` \| `"virtual"` \| `"display"` \| `"window"` | no | default `"primary"` |
| `displayIndex` | integer | no | monitor index from a prior `displays[]`; defaults to `0` if omitted, even when `target="display"` |
| `windowTitle` | string, ≤512 chars | only if `target="window"` | substring match, prefers the focused window — no sensible default, so this one is genuinely required in that case |
| `format` | `"auto"` \| `"png"` \| `"jpeg"` | no | default `"auto"` — PNG for small frames, JPEG for large |
| `quality` | integer 1–100 | no | JPEG only, default 80 |
| `maxWidth` | integer 16–10000 | no | downscale so width ≤ this |

**result:**
```json
{
  "format": "png|jpeg", "mimeType": "image/png|image/jpeg",
  "width": 0, "height": 0, "originalWidth": 0, "originalHeight": 0, "scale": 1.0,
  "originX": 0, "originY": 0,
  "displays": [{ "index": 0, "x": 0, "y": 0, "width": 0, "height": 0, "isPrimary": true, "dpi": 96 }],
  "virtualBounds": { "x": 0, "y": 0, "width": 0, "height": 0 },
  "cursor": { "x": 0, "y": 0 },
  "base64Data": "<base64-encoded PNG/JPEG bytes>"
}
```
> Map a screenshot pixel back to a real screen coordinate as `originX + pixelX / scale`. The image bytes come back inline in `base64Data` — decode it against `mimeType`, and it already has the system cursor drawn on it (no separate confirmation call needed). `displays[].dpi` is diagnostic only — coordinates are already consistent, you don't need to apply it yourself. Screenshots do not use storage, so no configuration is required.

### 4.8 `window.listWindows`
List visible top-level windows.

*No args.*

**result:**
```json
{
  "windows": [
    {
      "title": "string", "x": 0, "y": 0, "width": 0, "height": 0,
      "isFocused": true, "isMinimized": false, "isMaximized": false,
      "processId": 0, "processName": "string", "displayIndex": 0
    }
  ]
}
```

### 4.9 `cmd.execute`
Run one CMD command line through a real console (WinPTY) as the signed-in user.

| args | type | required | notes |
|---|---|---|---|
| `command` | string, 1–8,000 chars | yes | single command line, no literal `\0`/`\r`/`\n`; use `&`/`&&` to chain |
| `workingDirectory` | string, absolute path | no | must already exist; defaults to the user's profile folder |
| `timeoutMs` | integer 100–20,000 | no | default 10,000 |
| `maxOutputChars` | integer 1,024–400,000 | no | default 65,536 |

**result:**
```json
{
  "exitCode": 0,          // integer, or null if timedOut
  "timedOut": false,
  "output": "string",     // combined stdout/stderr, raw terminal text (may include ANSI escapes)
  "truncated": false,
  "durationMs": 0
}
```
> **Requires** the target machine's `windows-tool-service` to have "Allow remote CMD execution" enabled locally — this is a manual opt-in the signed-in user controls, it cannot be turned on remotely. If disabled, you'll get `ok:false, error:"CMD is disabled. Enable remote CMD in the agent window."`. Also requires an unlocked, interactive desktop (not locked/screen-saver/secure-desktop) — otherwise `ok:false, error:"Desktop unavailable or locked. Unlock the signed-in session first."`.

### 4.10 `file.read`
Read a file from the device's local disk. **Requires storage to be configured on the device** (§4.11) — there is no inline-bytes fallback.

| args | type | required | notes |
|---|---|---|---|
| `path` | string, ≤32,767 chars | yes | absolute Windows path; rejected if it's a directory, doesn't exist, or exceeds 10 MB |

**result:**
```json
{
  "path": "C:\\full\\resolved\\path.ext", "name": "path.ext", "size": 0,
  "contentType": "application/octet-stream", "uploaded": true, "url": "https://…presigned…"
}
```
> There is never a `base64Data` field — file bytes never travel over the relay/broker, only the presigned URL. If storage isn't configured, you'll get `ok:false, error:"Storage is not configured on this device. Configure storage to use file.read."`

### 4.11 Storage is mandatory for `file.read`
`file.read` always uploads the file's bytes to S3-compatible storage on the device and returns a presigned URL — **there is no inline-base64 mode**, by design, so file bytes never pass through the broker or MCP server. Every machine that needs to serve `file.read` must have storage configured locally in `windows-tool-service` (`E2StorageEndpoint`/`E2StorageRegion`/`E2StorageBucket`/`E2StorageAccessKey`/`E2StorageSecretKey`) — that's a local agent configuration concern, not something the MCP server sends per call. If it's missing, expect `ok:false` with the error quoted above instead of a result. (`screenshot.capture` needs no storage — it always returns inline `base64Data`.)

---

## 5. Every tool requiring desktop input can fail with one common error

`mouse.*`, `keyboard.*`, `screenshot.capture`, and `window.listWindows` all require an unlocked, interactive desktop session. If the machine is locked, on a UAC/secure desktop, or has no active session, every one of these returns:

```json
{ "ok": false, "error": "Desktop unavailable or locked. Unlock the signed-in session first." }
```

`cmd.execute` and `file.read` do **not** require this and work even on a locked machine.

---

## 6. Checklist for the backend team

1. Add MCP tool definitions for whichever of the 10 identifiers in §4 you want to expose to the AI agent (you can group them however fits your existing tool conventions — e.g. one consolidated `mouse` tool with an `action` enum, like the reference schema in [windows-tool-service/ToolInfo.json](../windows-tool-service/ToolInfo.json) — as long as your handler ultimately emits the exact `message_details.type` + `args` shape from §4).
2. When a tool is invoked, build the `MESSAGE_TO` envelope from §2 with `src:"MCP"`, `type` = the exact identifier, and `args` matching that tool's schema — no extra/renamed fields.
3. Send it to the broker targeting the desired `to_machine_id`/`to_username`; wait for the correlated response using `requestId`, with the timeout from §3.
4. On `ok:true`, return `result` to the caller; on `ok:false`, surface `error` as a tool failure (not a transport error) — do not retry automatically except for the `"Agent busy"` case.
5. No `deviceId`, registration, or handshake is needed for this integration — machine targeting is entirely `to_machine_id`/`to_username` at the broker level.
