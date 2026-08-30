import type { IMouseService } from "../../interfaces/mouse.service.js";
import type { MouseActionResult, MouseClickInput, MouseMoveInput } from "../../../models/mouse.models.js";
/**
 * Real cross-platform implementation backed by @nut-tree-fork/nut-js
 * (Windows, macOS, Linux/X11 native mouse driver).
 */
export declare class NutjsMouseService implements IMouseService {
    move(input: MouseMoveInput): Promise<MouseActionResult>;
    click(input: MouseClickInput): Promise<MouseActionResult>;
}
