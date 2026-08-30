import { screen } from "@nut-tree-fork/nut-js";
import { PNG } from "pngjs";
/**
 * Real cross-platform implementation backed by @nut-tree-fork/nut-js
 * (Windows, macOS, Linux/X11 native screen capture), PNG-encoded via pngjs
 * since nut.js only hands back a raw pixel buffer.
 */
export class NutjsScreenshotService {
    async capturePrimaryDisplay() {
        const captured = await screen.grab();
        const image = await captured.toRGB();
        const { width, height, byteWidth, channels, data } = image;
        const png = new PNG({ width, height });
        for (let y = 0; y < height; y++) {
            const rowStart = y * byteWidth;
            for (let x = 0; x < width; x++) {
                const src = rowStart + x * channels;
                const dst = (y * width + x) * 4;
                png.data[dst] = data[src];
                png.data[dst + 1] = data[src + 1];
                png.data[dst + 2] = data[src + 2];
                png.data[dst + 3] = channels === 4 ? data[src + 3] : 255;
            }
        }
        return {
            success: true,
            format: "png",
            base64Data: PNG.sync.write(png).toString("base64"),
            width,
            height,
            backend: "nutjs",
            timestamp: new Date().toISOString(),
        };
    }
}
