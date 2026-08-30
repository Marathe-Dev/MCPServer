import type { MouseActionResult, MouseClickInput, MouseMoveInput } from "../../models/mouse.models.js";
/**
 * Abstraction for mouse control. MCP tools depend only on this interface;
 * the concrete implementation (relay or nut-js) is swapped in behind it.
 */
export interface IMouseService {
    move(input: MouseMoveInput): Promise<MouseActionResult>;
    click(input: MouseClickInput): Promise<MouseActionResult>;
}
