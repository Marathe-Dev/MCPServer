import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import type { DeviceRegistry } from "../relay/device-registry.js";

/**
 * `mouse` — one tool for every mouse action on a device: move, click, scroll, or drag.
 * A discriminated union on `action` means each action exposes only its own fields.
 */
export function registerMouseTool(server: McpServer, deviceRegistry: DeviceRegistry): void {
  server.registerTool(
    "mouse",
    {
      description:
        "Control a device's mouse. Coordinates are absolute screen pixels — take an image pixel from a screenshot and map it with coordinateSpace: screenX = coordinateSpace.screenX + imageX * scaleX (identity when not downscaled). action=move/click use x,y; scroll uses amount (± notches) with optional x,y; drag goes from x,y to toX,toY.",
      inputSchema: z.object({
        deviceId: z.string().min(1).describe("Target deviceId from list_devices; not the readable deviceName"),
        action: z.enum(["move", "click", "scroll", "drag"]).describe("Which mouse action to perform"),
        x: z.number().int().optional().describe("X screen pixel — required for move/click/drag; optional scroll anchor"),
        y: z.number().int().optional().describe("Y screen pixel — required for move/click/drag; optional scroll anchor"),
        button: z.enum(["left", "right"]).default("left").describe("Button for click and drag"),
        clickType: z.enum(["single", "double"]).default("single").describe("Single or double click"),
        toX: z.number().int().optional().describe("Drag end X pixel (required for drag)"),
        toY: z.number().int().optional().describe("Drag end Y pixel (required for drag)"),
        amount: z.number().int().min(-100).max(100).optional().describe("Scroll notches; positive = up / right (required for scroll)"),
        axis: z.enum(["vertical", "horizontal"]).default("vertical").describe("Scroll axis"),
      }).refine(
        (a) =>
          a.action === "scroll"
            ? typeof a.amount === "number"
            : a.action === "drag"
              ? [a.x, a.y, a.toX, a.toY].every((n) => typeof n === "number")
              : typeof a.x === "number" && typeof a.y === "number",
        { message: "move/click need x,y; drag needs x,y,toX,toY; scroll needs amount." },
      ),
    },
    async ({ deviceId, ...rest }) => {
      const result = await deviceRegistry.sendRequest(deviceId, "RemoteMouse", rest);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    },
  );
}
