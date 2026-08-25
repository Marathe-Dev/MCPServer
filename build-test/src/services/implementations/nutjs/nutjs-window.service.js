import { getActiveWindow, getWindows } from "@nut-tree-fork/nut-js";
/**
 * Real cross-platform implementation backed by @nut-tree-fork/nut-js
 * (Windows, macOS, Linux/X11 native window enumeration).
 */
export class NutjsWindowService {
    async listWindows() {
        const [windows, activeWindow] = await Promise.all([
            getWindows(),
            getActiveWindow(),
        ]);
        const activeTitle = await activeWindow.title;
        const activeRegion = await activeWindow.region;
        const windowInfos = await Promise.all(windows.map(async (window) => {
            const title = await window.title;
            const region = await window.region;
            // nut.js exposes no stable window handle, so focus is matched by title + geometry.
            const isFocused = title === activeTitle &&
                region.left === activeRegion.left &&
                region.top === activeRegion.top &&
                region.width === activeRegion.width &&
                region.height === activeRegion.height;
            return {
                title,
                x: region.left,
                y: region.top,
                width: region.width,
                height: region.height,
                isFocused,
            };
        }));
        return {
            success: true,
            windows: windowInfos,
            backend: "nutjs",
            timestamp: new Date().toISOString(),
        };
    }
}
