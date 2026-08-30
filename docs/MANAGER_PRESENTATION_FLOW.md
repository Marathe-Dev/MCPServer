# MCP Flow for Manager Presentation

This document gives a short, presentation-friendly view of the current local MCP setup and the planned cloud MCP setup.

## 1. Current model: local MCP server on each device

This is the same basic pattern used by HopToDesk-style desktop control: the agent connects to a relay endpoint first, and the relay routes the request to the correct device's local MCP server when it wants screen, mouse, keyboard, or window access.

```mermaid
flowchart LR
    A[AI Agent / Desktop Agent] --> R[Relay endpoint\nroute request to device]
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
    Agent->>Relay: Call the relay URL
    Relay->>Local: Forward the request to the selected device
    Local->>Desktop: Perform the local OS action
    Desktop-->>Local: Return result
    Local-->>Relay: Send result back
    Relay-->>Agent: Return response
    Agent-->>User: Show answer
```

## 2. Planned model: cloud MCP server + local tool service

The cloud MCP server becomes the central entry point for agents. It will route device actions to the correct desktop through `local-tool-service`, and later it can also expose web tools and product services.

```mermaid
flowchart LR
    Agent[Web Agent / Desktop Agent] --> CloudMCP[Cloud MCP Server\nSingle public /mcp endpoint]

    CloudMCP --> DeviceList[List devices\nselect target device]
    CloudMCP --> Relay[Route tool call by deviceName]

    Relay --> LocalSvc[local-tool-service\nRuns on the target desktop]
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
    Agent->>Cloud: Call MCP tool
    Cloud->>Cloud: Decide whether the request is for web data or a device
    Cloud->>Local: Send desktop tool request when device access is needed
    Local->>Desktop: Perform real OS action
    Desktop-->>Local: Return result
    Local-->>Cloud: Send result back
    Cloud-->>Agent: Return unified answer
    Agent-->>User: Show answer in one place
```

## 4. Simple talking points

- Today: we already support local desktop access through a local MCP server.
- Next: the cloud MCP server will become the central control plane for many devices.
- Later: the same cloud server can also expose product web tools, account data, and internal services, so the user gets a single place to ask questions and act on both web and desktop resources.
