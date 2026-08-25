import type { IScreenshotService } from "./interfaces/screenshot.service.js";
import type { IMouseService } from "./interfaces/mouse.service.js";
import type { IKeyboardService } from "./interfaces/keyboard.service.js";
import type { IWindowService } from "./interfaces/window.service.js";
import { PlaceholderScreenshotService } from "./implementations/placeholder/placeholder-screenshot.service.js";
import { PlaceholderMouseService } from "./implementations/placeholder/placeholder-mouse.service.js";
import { PlaceholderKeyboardService } from "./implementations/placeholder/placeholder-keyboard.service.js";
import { PlaceholderWindowService } from "./implementations/placeholder/placeholder-window.service.js";

export interface ServiceRegistry {
  screenshotService: IScreenshotService;
  mouseService: IMouseService;
  keyboardService: IKeyboardService;
  windowService: IWindowService;
}

/**
 * Selects which concrete service implementations back the MCP tools.
 *
 * This is the single place that knows about backends. Everything above it
 * (MCP tools) only ever sees the `I*Service` interfaces. Today only
 * "placeholder" exists; future backends ("native", "remotepc-service", ...)
 * plug in here without changing any tool code.
 */
export function createServices(): ServiceRegistry {
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
      throw new Error(
        `Unknown TOOL_BACKEND "${backend}". Only "placeholder" is implemented so far.`,
      );
  }
}
