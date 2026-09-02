import type { DeviceRegistry } from "../relay/device-registry.js";
import { createServices } from "./service-factory.js";

/** Action names exposed to the REST API — mirror the MCP tool names 1:1. */
export type DashboardAction =
  | "screenshot"
  | "mouse_move"
  | "mouse_click"
  | "type_text"
  | "key_press"
  | "get_window_list";

export interface DashboardActionArgs {
  x?: number;
  y?: number;
  button?: "left" | "right";
  clickType?: "single" | "double";
  text?: string;
  keys?: string[];
}

/**
 * Single dispatch point shared by the REST `/api/action` route — calls the
 * same relay services the MCP tools use, keyed by a plain action name.
 */
export async function performAction(
  deviceId: string,
  action: DashboardAction,
  args: DashboardActionArgs,
  registry: DeviceRegistry,
): Promise<unknown> {
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
      const exhaustive: never = action;
      throw new Error(`Unknown action: ${String(exhaustive)}`);
    }
  }
}
