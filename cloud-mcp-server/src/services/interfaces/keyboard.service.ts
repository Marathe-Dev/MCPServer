import type {
  KeyPressInput,
  KeyboardActionResult,
  TypeTextInput,
} from "../../models/keyboard.models.js";

/**
 * Abstraction for keyboard control. MCP tools depend only on this
 * interface; the concrete implementation (relay or nut-js) is swapped in
 * behind it.
 */
export interface IKeyboardService {
  typeText(input: TypeTextInput): Promise<KeyboardActionResult>;
  keyPress(input: KeyPressInput): Promise<KeyboardActionResult>;
}
