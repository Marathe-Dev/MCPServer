export interface TypeTextInput {
    text: string;
}
export interface KeyPressInput {
    /** e.g. ["ctrl", "s"] or ["alt", "tab"] */
    keys: string[];
}
export interface KeyboardActionResult {
    success: boolean;
    backend: string;
    timestamp: string;
}
