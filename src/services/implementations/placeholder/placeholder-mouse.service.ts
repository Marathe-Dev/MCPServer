import type { IMouseService } from "../../interfaces/mouse.service.js";
import type {
  MouseActionResult,
  MouseClickInput,
  MouseMoveInput,
} from "../../../models/mouse.models.js";

/**
 * Deterministic placeholder implementation. Acknowledges the requested
 * coordinates without driving any real OS mouse API.
 */
export class PlaceholderMouseService implements IMouseService {
  async move(input: MouseMoveInput): Promise<MouseActionResult> {
    return {
      success: true,
      x: input.x,
      y: input.y,
      backend: "placeholder",
      timestamp: new Date().toISOString(),
    };
  }

  async click(input: MouseClickInput): Promise<MouseActionResult> {
    return {
      success: true,
      x: input.x,
      y: input.y,
      backend: "placeholder",
      timestamp: new Date().toISOString(),
    };
  }
}
