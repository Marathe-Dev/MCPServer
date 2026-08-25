import { PlaceholderScreenshotService } from "./implementations/placeholder/placeholder-screenshot.service.js";
import { PlaceholderMouseService } from "./implementations/placeholder/placeholder-mouse.service.js";
import { PlaceholderKeyboardService } from "./implementations/placeholder/placeholder-keyboard.service.js";
import { PlaceholderWindowService } from "./implementations/placeholder/placeholder-window.service.js";
/**
 * Selects which concrete service implementations back the MCP tools.
 *
 * This is the single place that knows about backends. Everything above it
 * (MCP tools) only ever sees the `I*Service` interfaces. Today only
 * "placeholder" exists; future backends ("native", "remotepc-service", ...)
 * plug in here without changing any tool code.
 */
export function createServices() {
    const backend = process.env.TOOL_BACKEND ?? "placeholder";
    switch (backend) {
        case "placeholder":
            return {
                screenshotService: new PlaceholderScreenshotService(),
                mouseService: new PlaceholderMouseService(),
                keyboardService: new PlaceholderKeyboardService(),
                windowService: new PlaceholderWindowService(),
            };
        default:
            throw new Error(`Unknown TOOL_BACKEND "${backend}". Only "placeholder" is implemented so far.`);
    }
}
