import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import type { DeviceRegistry } from "../relay/device-registry.js";

/**
 * `mouse` — one tool for every mouse action on a device: move, click, scroll, or drag.
 * Consolidates the former mouse_move/mouse_click tools and adds scroll + drag.
 */
export function registerMouseTool(server: McpServer, deviceRegistry: DeviceRegistry): void {
  server.registerTool(
    "mouse",
    {
      description:
        "Control a device's mouse. action=move (x,y); click (x,y,button,clickType); scroll (amount = ± notches, optional x,y and axis); drag (from x,y to toX,toY holding button). Coordinates are virtual-desktop pixels — map from a screenshot as originX + pixelX / scale.",
      inputSchema: z.object({
        deviceId: z.string().min(1).describe("Target deviceId from list_devices; not the readable deviceName"),
        action: z.enum(["move", "click", "scroll", "drag"]).describe("Which mouse action to perform"),
        x: z.number().int().optional().describe("X pixel — move/click target, scroll point, or drag start"),
        y: z.number().int().optional().describe("Y pixel — move/click target, scroll point, or drag start"),
        button: z.enum(["left", "right"]).default("left").describe("Button for click and drag"),
        clickType: z.enum(["single", "double"]).default("single").describe("Single or double click"),
        toX: z.number().int().optional().describe("Drag end X pixel"),
        toY: z.number().int().optional().describe("Drag end Y pixel"),
        amount: z.number().int().min(-100).max(100).optional().describe("Scroll notches; positive = up / right"),
        axis: z.enum(["vertical", "horizontal"]).default("vertical").describe("Scroll axis"),
      }),
    },
    async ({ deviceId, action, ...rest }) => {
      const result = await deviceRegistry.sendRequest(deviceId, `mouse.${action}`, rest);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    },
  );
}
