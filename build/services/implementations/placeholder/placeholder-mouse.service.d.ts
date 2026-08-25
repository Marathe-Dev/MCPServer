import type { IMouseService } from "../../interfaces/mouse.service.js";
import type { MouseActionResult, MouseClickInput, MouseMoveInput } from "../../../models/mouse.models.js";
/**
 * Deterministic placeholder implementation. Acknowledges the requested
 * coordinates without driving any real OS mouse API.
 */
export declare class PlaceholderMouseService implements IMouseService {
    move(input: MouseMoveInput): Promise<MouseActionResult>;
    click(input: MouseClickInput): Promise<MouseActionResult>;
}
