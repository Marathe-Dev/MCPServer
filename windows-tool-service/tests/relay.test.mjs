import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const require = createRequire(new URL("../../cloud-mcp-server/package.json", import.meta.url));
const { WebSocketServer } = require("ws");

test("C# relay handles fragmentation, concurrent ping, busy errors, reconnect and native CMD", { timeout: 25000 }, async () => {
  const server = new WebSocketServer({ host: "127.0.0.1", port: 0 });
  await once(server, "listening");
  const executable = fileURLToPath(new URL("../bin/Tests/Release/WindowsToolService.Tests.exe", import.meta.url));
  const child = spawn(executable, ["--relay", `ws://127.0.0.1:${server.address().port}`], { stdio: ["ignore", "pipe", "pipe"] });
  let output = "";
  child.stdout.on("data", (data) => { output += data; });
  child.stderr.on("data", (data) => { output += data; });
  const exit = once(child, "exit");
  const connection = () => new Promise((resolve) => server.once("connection", (socket) => {
    const messages = [];
    const waiters = [];
    socket.on("message", (raw) => {
      const message = JSON.parse(raw.toString());
      const index = waiters.findIndex((waiter) => waiter.match(message));
      if (index < 0) messages.push(message);
      else waiters.splice(index, 1)[0].resolve(message);
    });
    const next = (match) => {
      const index = messages.findIndex(match);
      if (index >= 0) return Promise.resolve(messages.splice(index, 1)[0]);
      return new Promise((resolve) => waiters.push({ match, resolve }));
    };
    resolve({ socket, next });
  }));
  try {
    let { socket, next } = await connection();
    assert.equal((await next((message) => message.type === "register")).deviceId, "windows-relay-test");
    const frame = JSON.stringify({ type: "tool_call", requestId: "echo", tool: "test.echo", args: { text: "fragmented text" } });
    socket.send(frame.slice(0, 35), { fin: false });
    socket.send(frame.slice(35), { fin: true });
    assert.equal((await next((message) => message.requestId === "echo")).result.text, "fragmented text");
    socket.send(JSON.stringify({ type: "tool_call", requestId: "wait", tool: "test.wait", args: {} }));
    socket.send(JSON.stringify({ type: "ping" }));
    assert.equal((await next((message) => message.type === "pong")).type, "pong");
    socket.send(JSON.stringify({ type: "tool_call", requestId: "busy", tool: "test.echo", args: {} }));
    assert.equal((await next((message) => message.requestId === "busy")).ok, false);
    assert.equal((await next((message) => message.requestId === "wait")).ok, true);
    socket.send(JSON.stringify({ type: "tool_call", requestId: "bad", tool: "unsupported", args: {} }));
    assert.match((await next((message) => message.requestId === "bad")).error, /Unsupported tool/);
    socket.send(JSON.stringify({ type: "tool_call", requestId: "cmd", tool: "cmd.execute", args: { command: "echo RELAY_WINPTY_OK" } }));
    const command = await next((message) => message.requestId === "cmd");
    assert.equal(command.ok, true);
    assert.equal(command.result.exitCode, 0);
    assert.match(command.result.output, /RELAY_WINPTY_OK/);
    const reconnected = connection();
    socket.terminate();
    ({ socket, next } = await reconnected);
    assert.equal((await next((message) => message.type === "register")).platform, "win32");
    socket.send(JSON.stringify({ type: "tool_call", requestId: "stop", tool: "test.stop", args: {} }));
    assert.equal((await next((message) => message.requestId === "stop")).ok, true);
    const [code] = await exit;
    assert.equal(code, 0, output);
  } finally {
    if (child.exitCode === null) { child.kill(); await exit; }
    for (const socket of server.clients) socket.terminate();
    await new Promise((resolve) => server.close(resolve));
  }
});