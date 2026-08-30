import { Button, mouse, Point } from "@nut-tree-fork/nut-js";
import type { IMouseService } from "../../interfaces/mouse.service.js";
import type {
  MouseActionResult,
  MouseClickInput,
  MouseMoveInput,
} from "../../../models/mouse.models.js";

/**
 * Real cross-platform implementation backed by @nut-tree-fork/nut-js
 * (Windows, macOS, Linux/X11 native mouse driver).
 */
export class NutjsMouseService implements IMouseService {
  async move(input: MouseMoveInput): Promise<MouseActionResult> {
    await mouse.setPosition(new Point(input.x, input.y));
    return {
      success: true,
      x: input.x,
      y: input.y,
      backend: "nutjs",
      timestamp: new Date().toISOString(),
    };
  }

  async click(input: MouseClickInput): Promise<MouseActionResult> {
    await mouse.setPosition(new Point(input.x, input.y));
    const button = input.button === "right" ? Button.RIGHT : Button.LEFT;
    if (input.clickType === "double") {
      await mouse.doubleClick(button);
    } else {
      await mouse.click(button);
    }
    return {
      success: true,
      x: input.x,
      y: input.y,
      backend: "nutjs",
      timestamp: new Date().toISOString(),
    };
  }
}
