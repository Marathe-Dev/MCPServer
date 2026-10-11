export interface ScreenshotResult {
    success: boolean;
    mimeType?: string;
    /** Presigned download URL; the cloud server fetches this server-side and inlines the bytes, then drops it from the final result. */
    url?: string;
    uploaded?: boolean;
    size?: number;
    width: number;
    height: number;
    /** Explicit image->screen mapping: screenX = coordinateSpace.screenX + imageX * scaleX (scaleX = 1 when not downscaled). */
    coordinateSpace?: {
        imageWidth: number;
        imageHeight: number;
        screenX: number;
        screenY: number;
        screenWidth: number;
        screenHeight: number;
        scaleX: number;
        scaleY: number;
    };
    displays?: Array<{
        index: number;
        displayId: string;
        name: string;
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
}
