import assert from "node:assert/strict";
import { test } from "node:test";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import WebSocket from "ws";
import { createApp } from "../../src/app.js";
import { buildDashboardWidget } from "../../src/api/dashboard-widget.js";
const DEVICE_ID = "test-device-1";
const DEVICE_NAME = "Office PC";
const FAKE_BACKEND = "fake-device";
/** Deterministic stand-in for a Local Tool Service's tool_call responses — no OS access. */
function fakeToolResult(message) {
    const timestamp = new Date().toISOString();
    const ok = (result) => ({
        type: "tool_result",
        requestId: message.requestId,
        ok: true,
        result,
    });
    switch (message.tool) {
        case "cmd.execute": {
            const args = message.args;
            assert.equal(args.timeoutMs, 10000);
            assert.equal(args.maxOutputChars, 65536);
            return ok({ success: args.command !== "exit /b 7", exitCode: args.command === "exit /b 7" ? 7 : 0,
                output: "hello\r\n", timedOut: false, truncated: false, backend: FAKE_BACKEND, timestamp });
        }
        case "mouse.move":
        case "mouse.click": {
            const { x, y } = message.args;
            return ok({ success: true, x, y, backend: FAKE_BACKEND, timestamp });
        }
        case "keyboard.typeText":
        case "keyboard.keyPress":
            return ok({ success: true, backend: FAKE_BACKEND, timestamp });
        case "screenshot.capturePrimaryDisplay":
            return ok({
                success: true,
                format: "png",
                base64Data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
                width: 1,
                height: 1,
                backend: FAKE_BACKEND,
                timestamp,
            });
        case "window.listWindows":
            return ok({
                success: true,
                windows: [{ title: "Fake Window", x: 0, y: 0, width: 800, height: 600, isFocused: true }],
                backend: FAKE_BACKEND,
                timestamp,
            });
        default:
            return {
                type: "tool_result",
                requestId: message.requestId,
                ok: false,
                error: `unsupported tool in test fake: ${String(message.tool)}`,
            };
    }
}
async function setUpHarness(deviceId) {
    const app = createApp();
    await new Promise((resolve) => app.httpServer.listen(0, "127.0.0.1", () => resolve()));
    const port = app.httpServer.address().port;
    let deviceSocket;
    if (deviceId) {
        deviceSocket = new WebSocket(`ws://127.0.0.1:${port}/device-link`);
        await new Promise((resolve, reject) => {
            deviceSocket?.once("open", () => resolve());
            deviceSocket?.once("error", reject);
        });
        deviceSocket.on("message", (raw) => {
            const message = JSON.parse(raw.toString());
            if (message.type === "tool_call") {
                deviceSocket?.send(JSON.stringify(fakeToolResult(message)));
            }
        });
        deviceSocket.send(JSON.stringify({ type: "register", deviceId, deviceName: DEVICE_NAME }));
        // Give the server a tick to process the registration before calling tools.
        await new Promise((resolve) => setTimeout(resolve, 50));
    }
    const transport = new StreamableHTTPClientTransport(new URL("http://test.local/mcp"), { fetch: (url, init) => app.mcpHandler.fetch(new Request(url, init)) });
    const client = new Client({ name: "test-harness", version: "1.0.0" }, { versionNegotiation: { mode: "auto" } });
    await client.connect(transport);
    return { app, client, deviceSocket };
}
async function tearDownHarness({ app, client, deviceSocket }) {
    await client.close();
    await app.mcpHandler.close();
    deviceSocket?.close();
    await new Promise((resolve) => app.httpServer.close(() => resolve()));
}
async function withRegisteredDevice(run) {
    const harness = await setUpHarness(DEVICE_ID);
    try {
        await run(harness.client);
    }
    finally {
        await tearDownHarness(harness);
    }
}
test("discovers all ten MCP tools through the relay", async () => {
    await withRegisteredDevice(async (client) => {
        const { tools } = await client.listTools();
        const names = tools.map((t) => t.name).sort();
        assert.deepStrictEqual(names, [
            "cmd",
            "get_dashboard_data",
            "get_window_list",
            "key_press",
            "list_devices",
            "mouse_click",
            "mouse_move",
            "screenshot",
            "show_dashboard",
            "type_text",
        ]);
        const targeted = new Set(["cmd", "get_window_list", "key_press", "mouse_click", "mouse_move", "screenshot", "type_text"]);
        for (const tool of tools.filter((tool) => targeted.has(tool.name))) {
            assert.ok(tool.inputSchema.required?.includes("deviceId"), tool.name);
            assert.ok(!Object.hasOwn(tool.inputSchema.properties ?? {}, "deviceName"), tool.name);
        }
    });
});
test("list_devices reports the connected fake device", async () => {
    await withRegisteredDevice(async (client) => {
        const result = await client.callTool({ name: "list_devices", arguments: {} });
        const [content] = result.content;
        const parsed = JSON.parse(content.text);
        assert.equal(parsed.success, true);
        assert.deepStrictEqual(parsed.devices, [{ deviceId: DEVICE_ID, deviceName: DEVICE_NAME }]);
    });
});
test("discovery preserves duplicate names, falls back to IDs and excludes offline devices", async () => {
    const harness = await setUpHarness(DEVICE_ID);
    try {
        const socket = harness.deviceSocket;
        harness.app.deviceRegistry.register("second-device", socket, { deviceName: DEVICE_NAME });
        harness.app.deviceRegistry.register("legacy-device", socket);
        harness.app.deviceRegistry.register("offline-device", socket, { deviceName: "Offline PC" });
        harness.app.deviceRegistry.unregister("offline-device", socket);
        const result = await harness.client.callTool({ name: "list_devices", arguments: {} });
        const [content] = result.content;
        const devices = JSON.parse(content.text).devices;
        assert.deepStrictEqual(devices.sort((left, right) => left.deviceId.localeCompare(right.deviceId)), [
            { deviceId: "legacy-device", deviceName: "legacy-device" },
            { deviceId: "second-device", deviceName: DEVICE_NAME },
            { deviceId: DEVICE_ID, deviceName: DEVICE_NAME },
        ]);
    }
    finally {
        await tearDownHarness(harness);
    }
});
test("targeting requires deviceId rather than a display name or legacy argument", async () => {
    await withRegisteredDevice(async (client) => {
        for (const args of [{ deviceName: DEVICE_ID }, { deviceId: DEVICE_NAME }, { deviceId: "" }]) {
            const result = await client.callTool({ name: "mouse_click", arguments: { ...args, x: 1, y: 2 } });
            assert.equal(result.isError, true);
        }
        const result = await client.callTool({ name: "mouse_click", arguments: { deviceId: DEVICE_ID, x: 1, y: 2 } });
        assert.notEqual(result.isError, true);
        const [content] = result.content;
        assert.equal(JSON.parse(content.text).success, true);
    });
});
test("dashboard MCP calls use deviceId while retaining readable labels", () => {
    const widget = buildDashboardWidget([]);
    assert.ok(widget.includes('{ deviceId:d.deviceId }'));
    assert.ok(widget.includes('{deviceId:id,text:inp.value}'));
    assert.ok(widget.includes('{deviceId:cid,x:'));
    assert.ok(widget.includes('{ deviceId:dev }'));
    assert.ok(widget.includes('showResult("Screenshot — "+d.deviceName'));
});
test("cmd relays defaults and surfaces nonzero exit codes as MCP errors", async () => {
    await withRegisteredDevice(async (client) => {
        for (const command of ["echo hello", "exit /b 7"]) {
            const result = await client.callTool({ name: "cmd", arguments: { deviceId: DEVICE_ID, command } });
            const [content] = result.content;
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
test("mouse_move relays through the fake device and back", async () => {
    await withRegisteredDevice(async (client) => {
        const result = await client.callTool({
            name: "mouse_move",
            arguments: { deviceId: DEVICE_ID, x: 42, y: 84 },
        });
        const [content] = result.content;
        const parsed = JSON.parse(content.text);
        assert.equal(parsed.success, true);
        assert.equal(parsed.x, 42);
        assert.equal(parsed.y, 84);
        assert.equal(parsed.backend, FAKE_BACKEND);
    });
});
test("screenshot relays a real-shaped PNG payload", async () => {
    await withRegisteredDevice(async (client) => {
        const result = await client.callTool({
            name: "screenshot",
            arguments: { deviceId: DEVICE_ID },
        });
        const [image, meta] = result.content;
        assert.equal(image.type, "image");
        assert.equal(image.mimeType, "image/png");
        assert.equal(typeof image.data, "string");
        const parsed = JSON.parse(meta.text);
        assert.equal(parsed.success, true);
        assert.equal(parsed.width, 1);
    });
});
test("get_window_list relays the fake device's window list", async () => {
    await withRegisteredDevice(async (client) => {
        const result = await client.callTool({
            name: "get_window_list",
            arguments: { deviceId: DEVICE_ID },
        });
        const [content] = result.content;
        const parsed = JSON.parse(content.text);
        assert.equal(parsed.success, true);
        assert.ok(Array.isArray(parsed.windows) && parsed.windows.length === 1);
        assert.equal(parsed.windows[0].title, "Fake Window");
    });
});
test("type_text and key_press succeed through the relay", async () => {
    await withRegisteredDevice(async (client) => {
        const typeResult = await client.callTool({
            name: "type_text",
            arguments: { deviceId: DEVICE_ID, text: "hello" },
        });
        const [typeContent] = typeResult.content;
        assert.equal(JSON.parse(typeContent.text).success, true);
        const keyResult = await client.callTool({
            name: "key_press",
            arguments: { deviceId: DEVICE_ID, keys: ["ctrl", "s"] },
        });
        const [keyContent] = keyResult.content;
        assert.equal(JSON.parse(keyContent.text).success, true);
    });
});
test("a tool call naming an unregistered device surfaces a clear MCP error", async () => {
    const harness = await setUpHarness(undefined);
    try {
        const result = await harness.client.callTool({
            name: "mouse_move",
            arguments: { deviceId: "unregistered-device", x: 1, y: 1 },
        });
        assert.equal(result.isError, true);
    }
    finally {
        await tearDownHarness(harness);
    }
});
