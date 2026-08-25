export interface WindowInfo {
    title: string;
    x: number;
    y: number;
    width: number;
    height: number;
    isFocused: boolean;
}
export interface WindowListResult {
    success: boolean;
    windows: WindowInfo[];
    backend: string;
    timestamp: string;
}
