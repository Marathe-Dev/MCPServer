import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { createServer } from "./create-server.js";

/**
 * Local MCP connection: Cline (or any MCP host) launches this file as a
 * child process and talks to it over stdin/stdout.
 */
serveStdio(createServer);
