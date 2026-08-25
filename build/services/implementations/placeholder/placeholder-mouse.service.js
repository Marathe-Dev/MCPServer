/**
 * Deterministic placeholder implementation. Acknowledges the requested
 * coordinates without driving any real OS mouse API.
 */
export class PlaceholderMouseService {
    async move(input) {
        return {
            success: true,
            x: input.x,
            y: input.y,
            backend: "placeholder",
            timestamp: new Date().toISOString(),
        };
    }
    async click(input) {
        return {
            success: true,
            x: input.x,
            y: input.y,
            backend: "placeholder",
            timestamp: new Date().toISOString(),
        };
    }
}
