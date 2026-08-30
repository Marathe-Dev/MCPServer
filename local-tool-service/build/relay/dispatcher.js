/** Dispatches an incoming tool_call to the matching real service and relays back the result. */
export function createDispatcher(services, client) {
    return async function dispatch(message) {
        console.error(`[local-tool-service] tool_call requestId=${message.requestId} tool=${message.tool} args=${JSON.stringify(message.args ?? {})}`);
        try {
            const result = await callTool(services, message);
            console.error(`[local-tool-service] tool_result requestId=${message.requestId} tool=${message.tool} ok=true`);
            client.send({
                type: "tool_result",
                requestId: message.requestId,
                ok: true,
                result,
            });
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`[local-tool-service] tool_result requestId=${message.requestId} tool=${message.tool} ok=false error=${errorMessage}`);
            client.send({
                type: "tool_result",
                requestId: message.requestId,
                ok: false,
                error: errorMessage,
            });
        }
    };
}
function callTool(services, message) {
    switch (message.tool) {
        case "mouse.move":
            return services.mouseService.move(message.args);
        case "mouse.click":
            return services.mouseService.click(message.args);
        case "keyboard.typeText":
            return services.keyboardService.typeText(message.args);
        case "keyboard.keyPress":
            return services.keyboardService.keyPress(message.args);
        case "screenshot.capturePrimaryDisplay":
            return services.screenshotService.capturePrimaryDisplay();
        case "window.listWindows":
            return services.windowService.listWindows();
        default:
            throw new Error(`Unsupported tool: ${String(message.tool)}`);
    }
}
