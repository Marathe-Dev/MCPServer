import * as z from "zod/v4";
/**
 * `type_text` — type text input via the keyboard.
 */
export function registerTypeTextTool(server, services) {
    server.registerTool("type_text", {
        description: "Type text input via the keyboard",
        inputSchema: z.object({
            text: z.string().describe("The text to type"),
        }),
    }, async ({ text }) => {
        const result = await services.keyboardService.typeText({ text });
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
    });
}
