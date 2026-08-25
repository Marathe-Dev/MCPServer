import assert from "node:assert/strict";
import { test } from "node:test";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { createMcpHandler } from "@modelcontextprotocol/server";
import { createServer } from "../../src/server/create-server.js";
const EXPECTED_TOOL_NAMES = [
    "screenshot",
    "mouse_move",
    "mouse_click",
    "type_text",
    "key_press",
    "get_window_list",
];
async function withClient(run) {
    const handler = createMcpHandler(createServer);
    const transport = new StreamableHTTPClientTransport(new URL("http://test.local/mcp"), { fetch: (url, init) => handler.fetch(new Request(url, init)) });
    const client = new Client({ name: "test-harness", version: "1.0.0" }, { versionNegotiation: { mode: "auto" } });
    await client.connect(transport);
    try {
        await run(client);
    }
    finally {
        await client.close();
        await handler.close();
    }
}
test("discovers all six RemotePC MCP tools", async () => {
    await withClient(async (client) => {
        const { tools } = await client.listTools();
        const names = tools.map((t) => t.name).sort();
        assert.deepStrictEqual(names, [...EXPECTED_TOOL_NAMES].sort());
    });
});
test("screenshot returns a real PNG image and metadata", async () => {
    await withClient(async (client) => {
        const result = await client.callTool({ name: "screenshot", arguments: {} });
        assert.equal(result.isError, undefined);
        const [image, meta] = result.content;
        assert.equal(image.type, "image");
        assert.equal(image.mimeType, "image/png");
        assert.equal(typeof image.data, "string");
        const parsed = JSON.parse(meta.text);
        assert.equal(parsed.success, true);
        assert.equal(parsed.backend, "nutjs");
        assert.ok(parsed.width > 0 && parsed.height > 0);
    });
});
test("mouse_move echoes the requested coordinates", async () => {
    await withClient(async (client) => {
        const result = await client.callTool({
            name: "mouse_move",
            arguments: { x: 500, y: 300 },
        });
        const [content] = result.content;
        const parsed = JSON.parse(content.text);
        assert.deepStrictEqual(parsed, {
            success: true,
            x: 500,
            y: 300,
            backend: "nutjs",
            timestamp: parsed.timestamp,
        });
    });
});
test("mouse_click defaults to left / single click", async () => {
    await withClient(async (client) => {
        const result = await client.callTool({
            name: "mouse_click",
            arguments: { x: 10, y: 20 },
        });
        const [content] = result.content;
        const parsed = JSON.parse(content.text);
        assert.equal(parsed.success, true);
        assert.equal(parsed.x, 10);
        assert.equal(parsed.y, 20);
        assert.equal(parsed.backend, "nutjs");
    });
});
test("type_text and key_press succeed", async () => {
    await withClient(async (client) => {
        const typeResult = await client.callTool({
            name: "type_text",
            arguments: { text: "hello" },
        });
        const [typeContent] = typeResult.content;
        assert.equal(JSON.parse(typeContent.text).success, true);
        const keyResult = await client.callTool({
            name: "key_press",
            arguments: { keys: ["ctrl", "s"] },
        });
        const [keyContent] = keyResult.content;
        assert.equal(JSON.parse(keyContent.text).success, true);
    });
});
test("get_window_list returns at least one real window", async () => {
    await withClient(async (client) => {
        const result = await client.callTool({
            name: "get_window_list",
            arguments: {},
        });
        const [content] = result.content;
        const parsed = JSON.parse(content.text);
        assert.equal(parsed.success, true);
        assert.equal(parsed.backend, "nutjs");
        assert.ok(Array.isArray(parsed.windows) && parsed.windows.length >= 1);
        assert.equal(typeof parsed.windows[0].title, "string");
    });
});
