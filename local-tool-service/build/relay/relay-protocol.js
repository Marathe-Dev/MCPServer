/**
 * Wire protocol for the WebSocket relay between the Cloud MCP Server and
 * each connected Local Tool Service. Kept identical (copy) in both projects.
 */
/** Parses and minimally validates one JSON relay frame. */
export function parseRelayMessage(raw) {
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" ||
        parsed === null ||
        typeof parsed.type !== "string") {
        throw new Error('Invalid relay message: missing "type"');
    }
    return parsed;
}
