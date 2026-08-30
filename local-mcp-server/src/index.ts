/**
 * Entrypoint. Chooses which transport to serve based on MCP_TRANSPORT:
 *   - "stdio" (default): local connection, e.g. launched by Cline
 *   - "http": remote Streamable HTTP connection
 */
const transport = process.env.MCP_TRANSPORT ?? "stdio";

if (transport === "http") {
  await import("./server/remote-server.js");
} else {
  await import("./server/local-server.js");
}
