import { createServices } from "./service-factory.js";
/**
 * Single dispatch point shared by the REST `/api/action` route — calls the
 * same relay services the MCP tools use, keyed by a plain action name.
 */
export async function performAction(deviceId, action, args, registry) {
    const services = createServices(deviceId, registry);
    switch (action) {
        case "screenshot":
            return services.screenshotService.capturePrimaryDisplay();
        case "mouse_move":
            return services.mouseService.move({ x: args.x ?? 0, y: args.y ?? 0 });
        case "mouse_click":
            return services.mouseService.click({
                x: args.x ?? 0,
                y: args.y ?? 0,
                button: args.button ?? "left",
                clickType: args.clickType ?? "single",
            });
        case "type_text":
            return services.keyboardService.typeText({ text: args.text ?? "" });
        case "key_press":
            return services.keyboardService.keyPress({ keys: args.keys ?? [] });
        case "get_window_list":
            return services.windowService.listWindows();
        default: {
            const exhaustive = action;
            throw new Error(`Unknown action: ${String(exhaustive)}`);
        }
    }
}
