/**
 * Deterministic placeholder implementation. Returns a fixed sample window
 * list without querying any real OS windowing API.
 */
export class PlaceholderWindowService {
    async listWindows() {
        return {
            success: true,
            windows: [
                {
                    title: "Placeholder Window",
                    x: 0,
                    y: 0,
                    width: 1280,
                    height: 720,
                    isFocused: true,
                },
            ],
            backend: "placeholder",
            timestamp: new Date().toISOString(),
        };
    }
}
