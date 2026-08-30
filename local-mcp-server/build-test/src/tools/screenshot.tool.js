import * as z from "zod/v4";
/**
 * `screenshot` — capture the primary display as a PNG image.
 * No arguments. Mirrors the HopToDesk MCP tool of the same name.
 */
export function registerScreenshotTool(server, services) {
    server.registerTool("screenshot", {
        description: "Capture the primary display as a PNG image",
        inputSchema: z.object({}),
    }, async () => {
        const result = await services.screenshotService.capturePrimaryDisplay();
        return {
            content: [
                {
                    type: "image",
                    data: result.base64Data,
                    mimeType: "image/png",
                },
                {
                    type: "text",
                    text: JSON.stringify({
                        success: result.success,
                        width: result.width,
                        height: result.height,
                        backend: result.backend,
                        timestamp: result.timestamp,
                    }),
                },
            ],
        };
    });
}
