import type {
  KeyPressInput,
  KeyboardActionResult,
  TypeTextInput,
} from "../../models/keyboard.models.js";

/**
 * Abstraction for keyboard control. MCP tools depend only on this
 * interface; OS-specific keyboard drivers are implemented behind it later.
 */
export interface IKeyboardService {
  typeText(input: TypeTextInput): Promise<KeyboardActionResult>;
  keyPress(input: KeyPressInput): Promise<KeyboardActionResult>;
}
