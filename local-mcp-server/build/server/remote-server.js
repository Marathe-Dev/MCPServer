import { createServer as createHttpServer } from "node:http";
import { createMcpHandler } from "@modelcontextprotocol/server";
import { toNodeHandler, localhostHostValidation, localhostOriginValidation, } from "@modelcontextprotocol/node";
import { createServer } from "./create-server.js";
/**
 * Remote MCP connection: serves the same tools over Streamable HTTP so an
 * MCP client can reach this server across the network.
 *
 * No authentication is implemented yet (out of scope for this phase); the
 * server binds to loopback by default and validates Host/Origin headers to
 * guard against DNS-rebinding from a browser context.
 */
const handler = createMcpHandler(createServer);
const nodeHandler = toNodeHandler(handler);
const validateHost = localhostHostValidation();
const validateOrigin = localhostOriginValidation();
const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "127.0.0.1";
const httpServer = createHttpServer((req, res) => {
    if (!validateHost(req, res) || !validateOrigin(req, res))
        return;
    void nodeHandler(req, res);
});
httpServer.listen(port, host, () => {
    console.error(`RemotePC MCP remote server listening on http://${host}:${port}/mcp`);
});
process.on("SIGINT", async () => {
    await handler.close();
    httpServer.close();
    process.exit(0);
});
