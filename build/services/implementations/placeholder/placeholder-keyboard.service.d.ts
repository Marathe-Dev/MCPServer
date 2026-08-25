import type { IKeyboardService } from "../../interfaces/keyboard.service.js";
import type { KeyPressInput, KeyboardActionResult, TypeTextInput } from "../../../models/keyboard.models.js";
/**
 * Deterministic placeholder implementation. Acknowledges the requested
 * input without driving any real OS keyboard API.
 */
export declare class PlaceholderKeyboardService implements IKeyboardService {
    typeText(_input: TypeTextInput): Promise<KeyboardActionResult>;
    keyPress(_input: KeyPressInput): Promise<KeyboardActionResult>;
}
