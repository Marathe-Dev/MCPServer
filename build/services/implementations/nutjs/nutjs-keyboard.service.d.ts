import type { IKeyboardService } from "../../interfaces/keyboard.service.js";
import type { KeyPressInput, KeyboardActionResult, TypeTextInput } from "../../../models/keyboard.models.js";
/**
 * Real cross-platform implementation backed by @nut-tree-fork/nut-js
 * (Windows, macOS, Linux/X11 native keyboard driver).
 */
export declare class NutjsKeyboardService implements IKeyboardService {
    typeText(input: TypeTextInput): Promise<KeyboardActionResult>;
    keyPress(input: KeyPressInput): Promise<KeyboardActionResult>;
}
