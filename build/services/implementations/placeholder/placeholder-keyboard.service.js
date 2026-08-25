/**
 * Deterministic placeholder implementation. Acknowledges the requested
 * input without driving any real OS keyboard API.
 */
export class PlaceholderKeyboardService {
    async typeText(_input) {
        return {
            success: true,
            backend: "placeholder",
            timestamp: new Date().toISOString(),
        };
    }
    async keyPress(_input) {
        return {
            success: true,
            backend: "placeholder",
            timestamp: new Date().toISOString(),
        };
    }
}
