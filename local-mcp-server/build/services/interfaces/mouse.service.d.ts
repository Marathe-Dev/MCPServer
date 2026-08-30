import type { MouseActionResult, MouseClickInput, MouseMoveInput } from "../../models/mouse.models.js";
/**
 * Abstraction for mouse control. MCP tools depend only on this interface;
 * OS-specific mouse drivers are implemented behind it later.
 */
export interface IMouseService {
    move(input: MouseMoveInput): Promise<MouseActionResult>;
    click(input: MouseClickInput): Promise<MouseActionResult>;
}
