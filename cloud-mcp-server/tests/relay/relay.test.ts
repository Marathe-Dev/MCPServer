import assert from "node:assert/strict";
import { test } from "node:test";
import type { AddressInfo } from "node:net";

import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import WebSocket from "ws";

import { createApp, type CloudApp } from "../../src/app.js";
import type { RelayMessage, RelayRequestMessage } from "../../src/relay/relay-protocol.js";

const DEVICE_ID = "test-device-1";
const DEVICE_NAME = "Office PC";
const FAKE_BACKEND = "fake-device";

/** Deterministic stand-in for a Local Tool Service's tool_call responses — no OS access. */
function fakeToolResult(message: RelayRequestMessage): RelayMessage {
  const timestamp = new Date().toISOString();
  const ok = (result: unknown): RelayMessage => ({
    type: "tool_result",
    requestId: message.requestId,
    ok: true,
    result,
  });

  switch (message.tool) {
    case "RemoteCMD": {
      const args = message.args as { command: string; timeoutMs: number; maxOutputChars: number };
      assert.equal(args.timeoutMs, 10000);
      assert.equal(args.maxOutputChars, 65536);
      return ok({ success: args.command !== "exit /b 7", exitCode: args.command === "exit /b 7" ? 7 : 0,
        output: "hello\r\n", timedOut: false, truncated: false, backend: FAKE_BACKEND, timestamp });
    }
    case "RemoteMouse": {
      const a = message.args as { action: string; x?: number; y?: number; toX?: number; toY?: number; amount?: number; axis?: string };
      if (a.action === "scroll") return ok({ success: true, amount: a.amount, axis: a.axis, backend: FAKE_BACKEND, timestamp });
      if (a.action === "drag") return ok({ success: true, x: a.x, y: a.y, toX: a.toX, toY: a.toY, backend: FAKE_BACKEND, timestamp });
      return ok({ success: true, x: a.x, y: a.y, backend: FAKE_BACKEND, timestamp });
    }
    case "RemoteKeyboard":
      return ok({ success: true, backend: FAKE_BACKEND, timestamp });
    case "RemoteScreenshot": {
      const a = message.args as { detail?: string };
      const jpeg = a.detail === "low";
      return ok({
        success: true,
        format: jpeg ? "jpeg" : "png",
        mimeType: jpeg ? "image/jpeg" : "image/png",
        uploaded: true,
        url: "https://bucket.example/screenshots/x.png?X-Amz-Signature=demo",
        size: 1024,
        width: 1,
        height: 1,
        coordinateSpace: { imageWidth: 1, imageHeight: 1, screenX: 0, screenY: 0, screenWidth: 1, screenHeight: 1, scaleX: 1, scaleY: 1 },
        displays: [{ index: 0, displayId: "\\\\.\\DISPLAY1", name: "Generic Monitor", x: 0, y: 0, width: 1920, height: 1080, isPrimary: true, dpi: 96 }],
        virtualBounds: { x: 0, y: 0, width: 1920, height: 1080 },
        cursor: { x: 0, y: 0 },
        backend: FAKE_BACKEND,
        timestamp,
      });
    }
    case "RemoteWindowsList":
      return ok({
        success: true,
        windows: [{
          windowId: "0x00010001", title: "Fake Window", x: 0, y: 0, width: 800, height: 600, isFocused: true,
          isMinimized: false, isMaximized: false, processId: 4242, processName: "fake", displayIndex: 0,
        }],
        total: 1,
        offset: 0,
        count: 1,
        hasMore: false,
        backend: FAKE_BACKEND,
        timestamp,
      });
    case "RemoteGetFile": {
      const { path } = message.args as { path: string };
      if (path === "C:/upload") {
        return ok({ success: true, path, name: "report.pdf", size: 1234, contentType: "application/pdf",
          uploaded: true, url: "https://bucket.example/files/report.pdf?X-Amz-Signature=demo",
          backend: FAKE_BACKEND, timestamp });
      }
      if (path === "C:/too-big") {
        return ok({ success: true, path, name: "too-big", size: 20 * 1024 * 1024, base64Data: "", backend: FAKE_BACKEND, timestamp });
      }
      return ok({ success: true, path, name: "hello.txt", size: 5, base64Data: Buffer.from("hello").toString("base64"), backend: FAKE_BACKEND, timestamp });
    }
    default:
      return {
        type: "tool_result",
        requestId: message.requestId,
        ok: false,
        error: `unsupported tool in test fake: ${String((message as { tool: unknown }).tool)}`,
      };
  }
}

interface Harness {
  app: CloudApp;
  client: Client;
  deviceSocket?: WebSocket;
}

async function setUpHarness(deviceId: string | undefined): Promise<Harness> {
  const app = createApp();
  await new Promise<void>((resolve) => app.httpServer.listen(0, "127.0.0.1", () => resolve()));
  const port = (app.httpServer.address() as AddressInfo).port;

  let deviceSocket: WebSocket | undefined;
  if (deviceId) {
    deviceSocket = new WebSocket(`ws://127.0.0.1:${port}/device-link`);
    await new Promise<void>((resolve, reject) => {
      deviceSocket?.once("open", () => resolve());
      deviceSocket?.once("error", reject);
    });
    deviceSocket.on("message", (raw) => {
      const message = JSON.parse(raw.toString()) as RelayMessage;
      if (message.type === "tool_call") {
        deviceSocket?.send(JSON.stringify(fakeToolResult(message)));
      }
    });
    deviceSocket.send(JSON.stringify({ type: "register", deviceId, deviceName: DEVICE_NAME }));
    // Give the server a tick to process the registration before calling tools.
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  const transport = new StreamableHTTPClientTransport(
    new URL("http://test.local/mcp"),
    { fetch: (url, init) => app.mcpHandler.fetch(new Request(url, init)) },
  );
  const client = new Client(
    { name: "test-harness", version: "1.0.0" },
    { versionNegotiation: { mode: "auto" } },
  );
  await client.connect(transport);

  return { app, client, deviceSocket };
}

async function tearDownHarness({ app, client, deviceSocket }: Harness): Promise<void> {
  await client.close();
  await app.mcpHandler.close();
  deviceSocket?.close();
  await new Promise<void>((resolve) => app.httpServer.close(() => resolve()));
}

async function withRegisteredDevice(run: (client: Client) => Promise<void>): Promise<void> {
  const harness = await setUpHarness(DEVICE_ID);
  try {
    await run(harness.client);
  } finally {
    await tearDownHarness(harness);
  }
}

test("discovers all MCP tools through the relay", async () => {
  await withRegisteredDevice(async (client) => {
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();
    assert.deepStrictEqual(names, [
      "cmd",
      "get_file",
      "get_window_list",
      "keyboard",
      "list_devices",
      "mouse",
      "screenshot",
    ]);
    const targeted = new Set(["cmd", "get_file", "get_window_list", "keyboard", "mouse", "screenshot"]);
    for (const tool of tools.filter((tool) => targeted.has(tool.name))) {
      assert.ok(tool.inputSchema.required?.includes("deviceId"), tool.name);
      assert.ok(!Object.hasOwn(tool.inputSchema.properties ?? {}, "deviceName"), tool.name);
    }
  });
});

test("list_devices reports the connected fake device", async () => {
  await withRegisteredDevice(async (client) => {
    const result = await client.callTool({ name: "list_devices", arguments: {} });
    const [content] = result.content as Array<{ text: string }>;
    const parsed = JSON.parse(content.text);
    assert.equal(parsed.success, true);
    assert.deepStrictEqual(parsed.devices, [{ deviceId: DEVICE_ID, deviceName: DEVICE_NAME }]);
  });
});

test("discovery preserves duplicate names, falls back to IDs and excludes offline devices", async () => {
  const harness = await setUpHarness(DEVICE_ID);
  try {
    const socket = harness.deviceSocket!;
    harness.app.deviceRegistry.register("second-device", socket, { deviceName: DEVICE_NAME });
    harness.app.deviceRegistry.register("legacy-device", socket);
    harness.app.deviceRegistry.register("offline-device", socket, { deviceName: "Offline PC" });
    harness.app.deviceRegistry.unregister("offline-device", socket);
    const result = await harness.client.callTool({ name: "list_devices", arguments: {} });
    const [content] = result.content as Array<{ text: string }>;
    const devices = JSON.parse(content.text).devices as Array<{ deviceId: string; deviceName: string }>;
    assert.deepStrictEqual(devices.sort((left, right) => left.deviceId.localeCompare(right.deviceId)), [
      { deviceId: "legacy-device", deviceName: "legacy-device" },
      { deviceId: "second-device", deviceName: DEVICE_NAME },
      { deviceId: DEVICE_ID, deviceName: DEVICE_NAME },
    ]);
  } finally {
    await tearDownHarness(harness);
  }
});

test("targeting requires deviceId rather than a display name or legacy argument", async () => {
  await withRegisteredDevice(async (client) => {
    for (const args of [{ deviceName: DEVICE_ID }, { deviceId: DEVICE_NAME }, { deviceId: "" }]) {
      const result = await client.callTool({ name: "mouse", arguments: { action: "click", ...args, x: 1, y: 2 } });
      assert.equal(result.isError, true);
    }
    const result = await client.callTool({ name: "mouse", arguments: { deviceId: DEVICE_ID, action: "click", x: 1, y: 2 } });
    assert.notEqual(result.isError, true);
    const [content] = result.content as Array<{ text: string }>;
    assert.equal(JSON.parse(content.text).success, true);
  });
});

test("cmd relays defaults and surfaces nonzero exit codes as MCP errors", async () => {
  await withRegisteredDevice(async (client) => {
    for (const command of ["echo hello", "exit /b 7"]) {
      const result = await client.callTool({ name: "cmd", arguments: { deviceId: DEVICE_ID, command } });
      const [content] = result.content as Array<{ text: string }>;
      const parsed = JSON.parse(content.text);
      assert.equal(parsed.output, "hello\r\n");
      assert.equal(parsed.exitCode, command === "echo hello" ? 0 : 7);
      assert.equal(result.isError, command !== "echo hello");
    }
  });
});

test("cmd rejects multiline input and excessive timeout before relay", async () => {
  await withRegisteredDevice(async (client) => {
    for (const args of [{ command: "echo one\necho two" }, { command: "echo hello", timeoutMs: 20001 }]) {
      const result = await client.callTool({ name: "cmd", arguments: { deviceId: DEVICE_ID, ...args } });
      assert.equal(result.isError, true);
    }
  });
});

test("get_file relays a small file and rejects oversized results", async () => {
  await withRegisteredDevice(async (client) => {
    const ok = await client.callTool({ name: "get_file", arguments: { deviceId: DEVICE_ID, path: "C:/hello.txt" } });
    const [okContent] = ok.content as Array<{ text: string }>;
    const okPayload = JSON.parse(okContent.text);
    assert.equal(okPayload.success, true);
    assert.equal(Buffer.from(okPayload.base64Data, "base64").toString("utf-8"), "hello");
    assert.notEqual(ok.isError, true);
    const big = await client.callTool({ name: "get_file", arguments: { deviceId: DEVICE_ID, path: "C:/too-big" } });
    assert.equal(big.isError, true);
  });
});

test("get_file forwards a presigned URL when the agent uploads", async () => {
  await withRegisteredDevice(async (client) => {
    const res = await client.callTool({ name: "get_file", arguments: { deviceId: DEVICE_ID, path: "C:/upload" } });
    const [content] = res.content as Array<{ text: string }>;
    const parsed = JSON.parse(content.text);
    assert.ok(typeof parsed.url === "string" && parsed.url.includes("X-Amz-Signature"));
    assert.equal(parsed.base64Data, undefined);
    assert.notEqual(res.isError, true);
  });
});

test("mouse relays move through the fake device and back", async () => {
  await withRegisteredDevice(async (client) => {
    const result = await client.callTool({
      name: "mouse",
      arguments: { deviceId: DEVICE_ID, action: "move", x: 42, y: 84 },
    });
    const [content] = result.content as Array<{ text: string }>;
    const parsed = JSON.parse(content.text);
    assert.equal(parsed.success, true);
    assert.equal(parsed.x, 42);
    assert.equal(parsed.y, 84);
    assert.equal(parsed.backend, FAKE_BACKEND);
  });
});

test("mouse scroll and drag relay through the fake device", async () => {
  await withRegisteredDevice(async (client) => {
    const scroll = await client.callTool({ name: "mouse", arguments: { deviceId: DEVICE_ID, action: "scroll", amount: -3 } });
    const scrollParsed = JSON.parse((scroll.content as Array<{ text: string }>)[0].text);
    assert.equal(scrollParsed.success, true);
    assert.equal(scrollParsed.amount, -3);

    const drag = await client.callTool({ name: "mouse", arguments: { deviceId: DEVICE_ID, action: "drag", x: 1, y: 2, toX: 9, toY: 8 } });
    const dragParsed = JSON.parse((drag.content as Array<{ text: string }>)[0].text);
    assert.equal(dragParsed.success, true);
    assert.equal(dragParsed.toX, 9);
    assert.equal(dragParsed.toY, 8);
  });
});

test("screenshot inlines the image and returns coordinateSpace mapping", async () => {
  const pngBytes = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
  );
  const originalFetch = globalThis.fetch;
  // Intercept the presigned URL so the cloud handler can inline real bytes without network.
  globalThis.fetch = (async (input: unknown) =>
    typeof input === "string" && input.includes("X-Amz-Signature")
      ? new Response(pngBytes, { status: 200, headers: { "content-type": "image/png" } })
      : originalFetch(input as never)) as typeof fetch;
  try {
    await withRegisteredDevice(async (client) => {
      const res = await client.callTool({ name: "screenshot", arguments: { deviceId: DEVICE_ID } });
      const content = res.content as Array<Record<string, unknown>>;
      const image = content.find((c) => c.type === "image") as { data: string; mimeType: string };
      assert.ok(image && typeof image.data === "string" && image.mimeType === "image/png");
      const text = content.find((c) => c.type === "text") as { text: string };
      const parsed = JSON.parse(text.text);
      assert.equal(parsed.success, true);
      assert.equal(parsed.coordinateSpace.scaleX, 1);
      assert.equal(parsed.coordinateSpace.screenX, 0);
      assert.ok(Array.isArray(parsed.displays) && typeof parsed.displays[0].displayId === "string");
      assert.ok(typeof parsed.url === "string" && parsed.url.includes("X-Amz-Signature"));
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("get_window_list relays the fake device's window list", async () => {
  await withRegisteredDevice(async (client) => {
    const result = await client.callTool({
      name: "get_window_list",
      arguments: { deviceId: DEVICE_ID },
    });
    const [content] = result.content as Array<{ text: string }>;
    const parsed = JSON.parse(content.text);
    assert.equal(parsed.success, true);
    assert.ok(Array.isArray(parsed.windows) && parsed.windows.length === 1);
    assert.equal(parsed.windows[0].windowId, "0x00010001");
    assert.equal(parsed.windows[0].title, "Fake Window");
    assert.equal(parsed.windows[0].processName, "fake");
    assert.equal(parsed.windows[0].displayIndex, 0);
    assert.equal(parsed.windows[0].isMinimized, false);
    assert.equal(parsed.total, 1);
    assert.equal(parsed.offset, 0);
    assert.equal(parsed.count, 1);
    assert.equal(parsed.hasMore, false);
  });
});

test("keyboard type and press succeed through the relay", async () => {
  await withRegisteredDevice(async (client) => {
    const typeResult = await client.callTool({
      name: "keyboard",
      arguments: { deviceId: DEVICE_ID, action: "type", text: "hello" },
    });
    const [typeContent] = typeResult.content as Array<{ text: string }>;
    assert.equal(JSON.parse(typeContent.text).success, true);

    const keyResult = await client.callTool({
      name: "keyboard",
      arguments: { deviceId: DEVICE_ID, action: "press", keys: ["ctrl", "s"] },
    });
    const [keyContent] = keyResult.content as Array<{ text: string }>;
    assert.equal(JSON.parse(keyContent.text).success, true);
  });
});

test("a tool call naming an unregistered device surfaces a clear MCP error", async () => {
  const harness = await setUpHarness(undefined);
  try {
    const result = await harness.client.callTool({
      name: "mouse",
      arguments: { deviceId: "unregistered-device", action: "move", x: 1, y: 1 },
    });
    assert.equal(result.isError, true);
  } finally {
    await tearDownHarness(harness);
  }
});
