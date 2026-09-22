import assert from "node:assert/strict";
import net from "node:net";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

test("C# relay talks to a local named pipe in RPC mode (no register, ping/pong, tool_call, busy, reconnect)", { timeout: 25000 }, async () => {
  const pipeName = `wts-test-${process.pid}-${Date.now()}`;
  const server = net.createServer();
  server.listen(`\\\\.\\pipe\\${pipeName}`);
  await once(server, "listening");
  const executable = fileURLToPath(new URL("../bin/Tests/Release/WindowsToolService.Tests.exe", import.meta.url));
  const child = spawn(executable, ["--pipe", pipeName], { stdio: ["ignore", "pipe", "pipe"] });
  let output = "";
  child.stdout.on("data", (data) => { output += data; });
  child.stderr.on("data", (data) => { output += data; });
  const exit = once(child, "exit");
  const connection = () => new Promise((resolve) => server.once("connection", (socket) => {
    let buffer = "";
    const messages = [];
    const waiters = [];
    socket.setEncoding("utf8");
    socket.on("data", (chunk) => {
      buffer += chunk;
      let index;
      while ((index = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, index);
        buffer = buffer.slice(index + 1);
        if (!line) continue;
        const message = JSON.parse(line);
        const waiterIndex = waiters.findIndex((waiter) => waiter.match(message));
        if (waiterIndex < 0) messages.push(message);
        else waiters.splice(waiterIndex, 1)[0].resolve(message);
      }
    });
    const send = (message) => socket.write(JSON.stringify(message) + "\n");
    const next = (match) => {
      const index = messages.findIndex(match);
      if (index >= 0) return Promise.resolve(messages.splice(index, 1)[0]);
      return new Promise((resolve) => waiters.push({ match, resolve }));
    };
    resolve({ socket, send, next, messages });
  }));
  try {
    let { socket, send, next, messages } = await connection();

    // RPCService/broker own device identity in "rpc" mode; the client must not send a register handshake.
    await new Promise((resolve) => setTimeout(resolve, 300));
    assert.equal(messages.some((message) => message.type === "register"), false, "no register handshake over the pipe");

    send({ type: "ping" });
    assert.equal((await next((message) => message.type === "pong")).type, "pong");

    send({ type: "tool_call", requestId: "echo", tool: "test.echo", args: { text: "pipe text" } });
    assert.equal((await next((message) => message.requestId === "echo")).result.text, "pipe text");

    send({ type: "tool_call", requestId: "wait", tool: "test.wait", args: {} });
    send({ type: "tool_call", requestId: "busy", tool: "test.echo", args: {} });
    assert.equal((await next((message) => message.requestId === "busy")).ok, false);
    assert.equal((await next((message) => message.requestId === "wait")).ok, true);

    const reconnected = connection();
    socket.destroy();
    ({ socket, send, next, messages } = await reconnected);
    send({ type: "tool_call", requestId: "stop", tool: "test.stop", args: {} });
    assert.equal((await next((message) => message.requestId === "stop")).ok, true);

    const [code] = await exit;
    assert.equal(code, 0, output);
  } finally {
    if (child.exitCode === null) { child.kill(); await exit; }
    server.close();
  }
});
