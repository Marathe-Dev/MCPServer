export interface ScreenshotResult {
  success: boolean;
  format: "png" | "jpeg";
  mimeType?: string;
  /** Base64-encoded image bytes. */
  base64Data: string;
  width: number;
  height: number;
  originalWidth?: number;
  originalHeight?: number;
  scale?: number;
  originX?: number;
  originY?: number;
  displays?: Array<{ index: number; x: number; y: number; width: number; height: number; isPrimary: boolean }>;
  virtualBounds?: { x: number; y: number; width: number; height: number };
  cursor?: { x: number; y: number };
  backend: string;
  timestamp: string;
}
