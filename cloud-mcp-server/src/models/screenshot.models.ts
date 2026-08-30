export interface ScreenshotResult {
  success: boolean;
  format: "png";
  /** Base64-encoded image bytes. */
  base64Data: string;
  width: number;
  height: number;
  backend: string;
  timestamp: string;
}
