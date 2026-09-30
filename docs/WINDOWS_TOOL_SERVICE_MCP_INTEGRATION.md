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
    "type": "RemoteCMD",
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
| `RemoteCMD` | 30,000 ms (caller's own `timeoutMs` arg caps execution at 20,000 ms; leave headroom for I/O) |
| `RemoteScreenshot` | 60,000 ms (capture + encoding of large frames) |
| `RemoteGetFile` | 30,000 ms (upload for larger files) |
| everything else (mouse/keyboard/window) | 15,000 ms |

- If the machine's `windows-tool-service` isn't connected to RPCService at all (pipe down), RPCService should surface that as its own transport-level error to the broker — that's outside `windows-tool-service`'s contract.

---

## 4. Tool catalog — exact identifiers, args, and results

Every table below is the **authoritative wire contract**. `args` must be sent exactly as shown; `result` is exactly what comes back inside `tool_result.result`. All results also include a common envelope: `success` (bool), `backend` (string, e.g. `"win32"`/`"winpty"`), `timestamp` (ISO-8601 UTC) — omitted from the tables below for brevity, but always present.

### 4.1 `mouse`
One tool for every mouse action; `args.action` selects the sub-behavior.

| args | type | required | notes |
|---|---|---|---|
| `action` | `"move"` \| `"click"` \| `"scroll"` \| `"drag"` | yes | which mouse action to perform |
| `x`, `y` | integer | for `move`/`click`/`drag` (drag start); optional for `scroll` | virtual-desktop pixel |
| `button` | `"left"` \| `"right"` | no | default `"left"`; used by `click`/`drag` |
| `clickType` | `"single"` \| `"double"` | no | default `"single"`; used by `click` |
| `toX`, `toY` | integer | yes for `drag` | drag end |
| `amount` | integer, -100..100 | yes for `scroll` | notches; positive = up/right |
| `axis` | `"vertical"` \| `"horizontal"` | no | default `"vertical"`; used by `scroll` |

**result:** `move`/`click` → `{ x, y }`; `scroll` → `{ amount, axis }`; `drag` → `{ x, y, toX, toY }`

### 4.2 `keyboard`
One tool for keyboard input; `args.action` selects `type` (literal text) or `press` (key combo).

| args | type | required | notes |
|---|---|---|---|
| `action` | `"type"` \| `"press"` | yes | `type` sends literal text; `press` taps a key combination together, then releases in reverse order |
| `text` | string, ≤20,000 chars | yes for `type` | typed as key-down/up pairs per character |
| `keys` | array of strings, 1–16 items | yes for `press` | e.g. `["ctrl", "s"]`. Accepts letters, digits, F1–F24, and aliases (`ctrl`/`alt`/`shift`/`win`, `enter`, `esc`, `tab`, `space`, `backspace`, `delete`, arrows, `home`/`end`/`pageup`/`pagedown`, punctuation) |

**result:** *(envelope only)*

### 4.3 `RemoteScreenshot`
Capture a screen region. **Requires storage to be configured on the device** (§4.7) — there is no inline-base64 fallback, so a misconfigured device fails clearly instead of flooding the relay with image bytes. The agent forces Per-Monitor-V2 DPI awareness at startup, so at native detail the image pixels equal physical screen pixels **1:1** and match `mouse` input coordinates exactly, even at non-100% display scale or across mixed-DPI monitors.

| args | type | required | notes |
|---|---|---|---|
| `target` | `"primary"` \| `"virtual"` \| `"display"` \| `"window"` | no | default `"primary"` (single display, crisp 1:1) |
| `displayId` | string | only if `target="display"` | stable id from a prior `displays[].displayId` (e.g. `\\.\DISPLAY1`); falls back to `displayIndex` if given |
| `windowId` | string | only if `target="window"` | hex handle from `RemoteWindowsList` (e.g. `0x000A1234`); falls back to `windowTitle` substring if given |
| `detail` | `"low"` \| `"medium"` \| `"high"` | no | default `"high"` — server picks encoding/resolution: high = native PNG (crisp text), medium = PNG capped ~1920w, low = JPEG capped ~1280w |

**result:**
```json
{
  "format": "png|jpeg", "mimeType": "image/png|image/jpeg",
  "width": 0, "height": 0,
  "coordinateSpace": {
    "imageWidth": 0, "imageHeight": 0,
    "screenX": 0, "screenY": 0, "screenWidth": 0, "screenHeight": 0,
    "scaleX": 1.0, "scaleY": 1.0
  },
  "displays": [{ "index": 0, "displayId": "\\.\\DISPLAY1", "name": "...", "x": 0, "y": 0, "width": 0, "height": 0, "isPrimary": true, "dpi": 96 }],
  "virtualBounds": { "x": 0, "y": 0, "width": 0, "height": 0 },
  "cursor": { "x": 0, "y": 0 },
  "uploaded": true, "size": 0, "url": "https://…presigned…"
}
```
> Map an image pixel to a real screen coordinate with `coordinateSpace`: `screenX = coordinateSpace.screenX + imageX * scaleX` (and likewise for Y). At default `detail="high"` there is no downscale so `scaleX = scaleY = 1` — the image pixel **is** the screen coordinate. There is never a `base64Data` field on the wire; image bytes travel only via the presigned URL, and the cloud MCP server fetches that URL and returns the image inline to the model. The system cursor is drawn on the image. `displays[].dpi` is diagnostic only — you do not apply it. If storage isn't configured, you'll get `ok:false, error:"Storage is not configured on this device. Configure storage to use RemoteScreenshot."`

### 4.4 `RemoteWindowsList`
List visible top-level windows, 15 per page. Minimized and DWM-cloaked (hidden) windows are excluded unless `includeMinimized` is true.

| args | type | required | notes |
|---|---|---|---|
| `offset` | integer ≥ 0 | no | default `0`; skip this many windows to get the next page |
| `includeMinimized` | boolean | no | default `false`; include minimized/cloaked windows |

**result:**
```json
{
  "windows": [
    {
      "windowId": "0x000A1234", "title": "string", "x": 0, "y": 0, "width": 0, "height": 0,
      "isFocused": true, "isMinimized": false, "isMaximized": false,
      "processId": 0, "processName": "string", "displayIndex": 0
    }
  ],
  "total": 0, "offset": 0, "count": 0, "hasMore": false
}
```
> Pass `windowId` to `RemoteScreenshot` (`target="window"`) to capture a specific window deterministically — titles can be duplicated, ids can't. `windows` never has more than 15 entries; `total` is the overall match count, `count` is this page's size, and `hasMore` tells you whether to call again with `offset` = previous `offset + count`.

### 4.5 `RemoteCMD`
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

### 4.6 `RemoteGetFile`
Read a file from the device's local disk. **Requires storage to be configured on the device** (§4.7) — there is no inline-bytes fallback.

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
> There is never a `base64Data` field — file bytes never travel over the relay/broker, only the presigned URL. If storage isn't configured, you'll get `ok:false, error:"Storage is not configured on this device. Configure storage to use RemoteGetFile."`

### 4.7 Storage is mandatory for `RemoteScreenshot` and `RemoteGetFile`
Both tools always upload their bytes to S3-compatible storage on the device and return a presigned URL — **there is no inline-base64 mode at all**, by design, so file/image bytes never pass through the broker or MCP server. This means every machine that needs to serve these two tools must have storage configured locally in `windows-tool-service` (`E2StorageEndpoint`/`E2StorageRegion`/`E2StorageBucket`/`E2StorageAccessKey`/`E2StorageSecretKey`) — that's a local agent configuration concern, not something the MCP server sends per call. If it's missing, expect `ok:false` with the errors quoted above instead of a result.

---

## 5. Every tool requiring desktop input can fail with one common error

`mouse`, `keyboard`, `RemoteScreenshot`, and `RemoteWindowsList` all require an unlocked, interactive desktop session. If the machine is locked, on a UAC/secure desktop, or has no active session, every one of these returns:

```json
{ "ok": false, "error": "Desktop unavailable or locked. Unlock the signed-in session first." }
```

`RemoteCMD` and `RemoteGetFile` do **not** require this and work even on a locked machine.

---

## 6. Checklist for the backend team

1. Add MCP tool definitions for whichever of the 6 identifiers in §4 you want to expose to the AI agent (`mouse` and `keyboard` are already consolidated with an `action` enum — see the reference schema in [windows-tool-service/ToolInfo.json](../windows-tool-service/ToolInfo.json) — as long as your handler ultimately emits the exact `message_details.type` + `args` shape from §4).
2. When a tool is invoked, build the `MESSAGE_TO` envelope from §2 with `src:"MCP"`, `type` = the exact identifier, and `args` matching that tool's schema — no extra/renamed fields.
3. Send it to the broker targeting the desired `to_machine_id`/`to_username`; wait for the correlated response using `requestId`, with the timeout from §3.
4. On `ok:true`, return `result` to the caller; on `ok:false`, surface `error` as a tool failure (not a transport error) — do not retry automatically except for the `"Agent busy"` case.
5. No `deviceId`, registration, or handshake is needed for this integration — machine targeting is entirely `to_machine_id`/`to_username` at the broker level.
