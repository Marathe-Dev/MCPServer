import { Button, mouse, Point } from "@nut-tree-fork/nut-js";
/**
 * Real cross-platform implementation backed by @nut-tree-fork/nut-js
 * (Windows, macOS, Linux/X11 native mouse driver).
 */
export class NutjsMouseService {
    async move(input) {
        await mouse.setPosition(new Point(input.x, input.y));
        return {
            success: true,
            x: input.x,
            y: input.y,
            backend: "nutjs",
            timestamp: new Date().toISOString(),
        };
    }
    async click(input) {
        await mouse.setPosition(new Point(input.x, input.y));
        const button = input.button === "right" ? Button.RIGHT : Button.LEFT;
        if (input.clickType === "double") {
            await mouse.doubleClick(button);
        }
        else {
            await mouse.click(button);
        }
        return {
            success: true,
            x: input.x,
            y: input.y,
            backend: "nutjs",
            timestamp: new Date().toISOString(),
        };
    }
}
