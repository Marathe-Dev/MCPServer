import type { MouseActionResult, MouseClickInput, MouseMoveInput } from "../../models/mouse.models.js";
/**
 * Abstraction for mouse control. The dispatcher depends only on this
 * interface; `NutjsMouseService` is the concrete implementation.
 */
export interface IMouseService {
    move(input: MouseMoveInput): Promise<MouseActionResult>;
    click(input: MouseClickInput): Promise<MouseActionResult>;
}
