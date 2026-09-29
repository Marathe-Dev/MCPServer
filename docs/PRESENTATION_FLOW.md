# MCP Flow for Presentation

This document gives a short, presentation-friendly view of the current local MCP setup and the planned cloud MCP setup.

## 1. Current model: local MCP server on each device

This is the same basic pattern used by HopToDesk-style desktop control: the agent connects to a relay endpoint first, and the relay routes the request to the correct device's local MCP server when it wants screen, mouse, keyboard, or window access.

```mermaid
flowchart LR
    A[AI Agent / Desktop Agent] -- "Streamable HTTP" --> R[Relay endpoint\nroute request to device]
    R --> B[Target device MCP server\nlocal-mcp-server on the selected device]
    B --> C[Local OS Automation\nmouse / keyboard / screenshot / windows]
    C --> D[User's desktop]
```

### What this gives us today

- The agent can access the user's local system.
- The relay can direct each request to the correct device MCP server.
- Each device is controlled independently.
- The implementation stays simple because the local server is focused only on desktop automation.

### End-to-end flow in simple terms

```mermaid
sequenceDiagram
    participant User as User
    participant Agent as AI Agent
    participant Relay as Relay endpoint
    participant Local as Device MCP server
    participant Desktop as User's device

    User->>Agent: Ask for an action or information
    Agent->>Relay: Call the relay URL (Streamable HTTP)
    Relay->>Local: Forward the request to the selected device (WebSocket)
    Local->>Desktop: Perform the local OS action
    Desktop-->>Local: Return result
    Local-->>Relay: Send result back (WebSocket)
    Relay-->>Agent: Return response (Streamable HTTP)
    Agent-->>User: Show answer
```

## 2. Planned model: cloud MCP server + local tool service

The cloud MCP server becomes the central entry point for agents. It will route device actions to the correct desktop through `local-tool-service`, and later it can also expose web tools and product services.

```mermaid
flowchart LR
    Agent[Web Agent / Desktop Agent] -- "Streamable HTTP" --> CloudMCP[Cloud MCP Server\nSingle public /mcp endpoint]

    CloudMCP --> DeviceList[List devices\nselect target device]
    CloudMCP --> Relay[Route tool call by deviceId]

    Relay -- "WebSocket" --> LocalSvc[local-tool-service\nRuns on the target desktop]
    LocalSvc --> LocalOS[Local OS automation\nmouse / keyboard / screenshot / windows]

    CloudMCP --> WebTools[Future web tools\naccount, product DB, services]
    WebTools --> Product[Product web platform]
```

### Why the cloud model matters

- One agent connection can see all connected devices.
- The cloud server can later include web-based tools, not only desktop control.
- User context can live in one place: account data, product data, device data, and desktop actions.
- This makes the agent experience more complete for both web and desktop usage.

## 3. End-to-end flow in simple terms

```mermaid
sequenceDiagram
    participant User as User
    participant Agent as AI Agent
    participant Cloud as Cloud MCP Server
    participant Local as local-tool-service
    participant Desktop as User's device

    User->>Agent: Ask for an action or information
    Agent->>Cloud: Call MCP tool (Streamable HTTP)
    Cloud->>Cloud: Decide whether the request is for web data or a device
    Cloud->>Local: Send desktop tool request when device access is needed (WebSocket)
    Local->>Desktop: Perform real OS action
    Desktop-->>Local: Return result
    Local-->>Cloud: Send result back (WebSocket)
    Cloud-->>Agent: Return unified answer (Streamable HTTP)
    Agent-->>User: Show answer in one place
```

## 4. Current & future optimisation plan

- Today: we already support local desktop access through a local MCP server.
- Next: the cloud MCP server will become the central control plane for many devices.
- Later: the same cloud server can also expose product web tools, account data, and internal services, so the user gets a single place to ask questions and act on both web and desktop resources.

## 5. Production-ready flow (current implementation)

This is the flow now built and running end-to-end — five components, from the AI agent down to the real desktop action and back. Unlike the models above, this one reuses the **existing RemotePC broker and RPCService** already deployed on every managed machine, instead of a new relay.

```mermaid
flowchart LR
    Agent[AI Agent] -- "MCP call" --> MCPServer[Production MCP Server]
    MCPServer -- "MESSAGE_TO (src: MCP)" --> Broker[RemotePC Broker]
    Broker -- "routes by machine ID" --> RPCService["RPCService\n(RemotePCService.exe, on target PC)"]
    RPCService -- "tool_call (named pipe)" --> WTS["windows-tool-service\n(WPF agent, same PC)"]
    WTS --> OS["Real OS action\nmouse / keyboard / screenshot / cmd / file"]
```

### Step by step

1. **AI Agent** calls a tool on the **MCP Server**, naming the target machine.
2. **MCP Server** builds a `MESSAGE_TO` message (marked `src: "MCP"`) and sends it to the **RemotePC Broker** — the same broker already used for all other RemotePC traffic.
3. **RemotePC Broker** routes the message to the correct machine, same as any other broker message.
4. **RPCService** (the existing C++ Windows service already running on every managed PC) sees `src: "MCP"` and diverts the message to a local named pipe instead of handling it itself.
5. **windows-tool-service** (a small WPF app running in the signed-in user's own desktop session) is the only thing on the other end of that pipe. It receives the tool call, actually performs it (mouse, keyboard, screenshot, CMD, file read), and sends the result back over the same pipe.
6. The result travels back the exact same path in reverse: windows-tool-service → RPCService → Broker → MCP Server → AI Agent.

### Why it's split this way

- **RPCService** already runs as a Windows service with full system access on every machine — perfect for owning the local pipe, but services don't share the interactive user's desktop session, so it can't safely move the mouse or take a screenshot itself.
- **windows-tool-service** runs *inside* the signed-in user's session — the only place that can actually control the desktop — but has no direct connection to the broker.
- Together they give the AI agent full desktop control without either side taking on a job it can't safely do, and without needing any new infrastructure beyond what's already deployed.

### Sequence view

```mermaid
sequenceDiagram
    participant Agent as AI Agent
    participant MCP as MCP Server
    participant Broker as RemotePC Broker
    participant RPC as RPCService (C++)
    participant WTS as windows-tool-service

    Agent->>MCP: Call tool (e.g. take a screenshot)
    MCP->>Broker: MESSAGE_TO {src: "MCP", machine, tool, args}
    Broker->>RPC: Route to target machine
    RPC->>WTS: tool_call over local named pipe
    WTS->>WTS: Perform the real action
    WTS-->>RPC: tool_result over the pipe
    RPC-->>Broker: MESSAGE_TO response
    Broker-->>MCP: Deliver response
    MCP-->>Agent: Tool result
```

