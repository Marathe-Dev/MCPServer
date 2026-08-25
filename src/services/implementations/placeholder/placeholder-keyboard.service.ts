import type { IKeyboardService } from "../../interfaces/keyboard.service.js";
import type {
  KeyPressInput,
  KeyboardActionResult,
  TypeTextInput,
} from "../../../models/keyboard.models.js";

/**
 * Deterministic placeholder implementation. Acknowledges the requested
 * input without driving any real OS keyboard API.
 */
export class PlaceholderKeyboardService implements IKeyboardService {
  async typeText(_input: TypeTextInput): Promise<KeyboardActionResult> {
    return {
      success: true,
      backend: "placeholder",
      timestamp: new Date().toISOString(),
    };
  }

  async keyPress(_input: KeyPressInput): Promise<KeyboardActionResult> {
    return {
      success: true,
      backend: "placeholder",
      timestamp: new Date().toISOString(),
    };
  }
}
