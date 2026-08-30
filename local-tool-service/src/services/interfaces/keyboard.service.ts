import type {
  KeyPressInput,
  KeyboardActionResult,
  TypeTextInput,
} from "../../models/keyboard.models.js";

/**
 * Abstraction for keyboard control. The dispatcher depends only on this
 * interface; `NutjsKeyboardService` is the concrete implementation.
 */
export interface IKeyboardService {
  typeText(input: TypeTextInput): Promise<KeyboardActionResult>;
  keyPress(input: KeyPressInput): Promise<KeyboardActionResult>;
}
