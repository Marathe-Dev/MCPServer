export interface ScreenshotResult {
    success: boolean;
    format: "png" | "jpeg";
    mimeType?: string;
    /** Presigned download URL; the agent always uploads to storage instead of inlining bytes. */
    url?: string;
    uploaded?: boolean;
    size?: number;
    width: number;
    height: number;
    originalWidth?: number;
    originalHeight?: number;
    scale?: number;
    originX?: number;
    originY?: number;
    displays?: Array<{
        index: number;
        x: number;
        y: number;
        width: number;
        height: number;
        isPrimary: boolean;
        dpi?: number;
    }>;
    virtualBounds?: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    cursor?: {
        x: number;
        y: number;
    };
    backend: string;
    timestamp: string;
}
