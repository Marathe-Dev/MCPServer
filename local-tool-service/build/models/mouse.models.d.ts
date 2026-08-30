export type MouseButton = "left" | "right";
export type MouseClickType = "single" | "double";
export interface MouseMoveInput {
    x: number;
    y: number;
}
export interface MouseClickInput extends MouseMoveInput {
    button: MouseButton;
    clickType: MouseClickType;
}
export interface MouseActionResult {
    success: boolean;
    x: number;
    y: number;
    backend: string;
    timestamp: string;
}
