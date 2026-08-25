import type { IScreenshotService } from "./interfaces/screenshot.service.js";
import type { IMouseService } from "./interfaces/mouse.service.js";
import type { IKeyboardService } from "./interfaces/keyboard.service.js";
import type { IWindowService } from "./interfaces/window.service.js";
import { PlaceholderScreenshotService } from "./implementations/placeholder/placeholder-screenshot.service.js";
import { PlaceholderMouseService } from "./implementations/placeholder/placeholder-mouse.service.js";
import { PlaceholderKeyboardService } from "./implementations/placeholder/placeholder-keyboard.service.js";
import { PlaceholderWindowService } from "./implementations/placeholder/placeholder-window.service.js";
import { NutjsScreenshotService } from "./implementations/nutjs/nutjs-screenshot.service.js";
import { NutjsMouseService } from "./implementations/nutjs/nutjs-mouse.service.js";
import { NutjsKeyboardService } from "./implementations/nutjs/nutjs-keyboard.service.js";
import { NutjsWindowService } from "./implementations/nutjs/nutjs-window.service.js";

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
 * (MCP tools) only ever sees the `I*Service` interfaces. "nutjs" (default)
 * drives the real OS mouse/keyboard/screen/window APIs via
 * @nut-tree-fork/nut-js; "placeholder" remains available for deterministic,
 * no-OS-access runs.
 */
export function createServices(): ServiceRegistry {
  const backend = process.env.TOOL_BACKEND ?? "nutjs";

  switch (backend) {
    case "nutjs":
      return {
        screenshotService: new NutjsScreenshotService(),
        mouseService: new NutjsMouseService(),
        keyboardService: new NutjsKeyboardService(),
        windowService: new NutjsWindowService(),
      };
    case "placeholder":
      return {
        screenshotService: new PlaceholderScreenshotService(),
        mouseService: new PlaceholderMouseService(),
        keyboardService: new PlaceholderKeyboardService(),
        windowService: new PlaceholderWindowService(),
      };
    default:
      throw new Error(
        `Unknown TOOL_BACKEND "${backend}". Valid values: "nutjs", "placeholder".`,
      );
  }
}
