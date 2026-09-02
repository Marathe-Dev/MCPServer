import { Router, type Request, type Response } from "express";
import * as z from "zod/v4";
import type { DeviceRegistry } from "../relay/device-registry.js";
import { performAction, type DashboardAction } from "../services/action-dispatcher.js";

const ACTION_NAMES = [
  "screenshot",
  "mouse_move",
  "mouse_click",
  "type_text",
  "key_press",
  "get_window_list",
] as const satisfies readonly DashboardAction[];

const actionRequestSchema = z.object({
  deviceId: z.string().min(1),
  action: z.enum(ACTION_NAMES),
  args: z
    .object({
      x: z.number().int().optional(),
      y: z.number().int().optional(),
      button: z.enum(["left", "right"]).optional(),
      clickType: z.enum(["single", "double"]).optional(),
      text: z.string().optional(),
      keys: z.array(z.string()).optional(),
    })
    .default({}),
});

/**
 * REST API consumed by the dashboard UI (and, indirectly, the show_dashboard
 * MCP tool's HTML widget). Every route reads from / dispatches through the
 * same `DeviceRegistry` the MCP tools use — no separate state.
 */
export function createDashboardRouter(registry: DeviceRegistry): Router {
  const router = Router();

  router.get("/devices", (_req: Request, res: Response) => {
    res.json({ devices: registry.listDevices(), timestamp: new Date().toISOString() });
  });

  router.get("/device-status/:deviceId", (req: Request, res: Response) => {
    const device = registry.getDevice(req.params.deviceId);
    if (!device) {
      res.status(404).json({ error: `Unknown device "${req.params.deviceId}"` });
      return;
    }
    res.json(device);
  });

  router.post("/action", (req: Request, res: Response) => {
    const parsed = actionRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues.map((i) => i.message).join("; ") });
      return;
    }
    const { deviceId, action, args } = parsed.data;
    if (!registry.getDevice(deviceId)) {
      res.status(404).json({ error: `Unknown device "${deviceId}"` });
      return;
    }
    performAction(deviceId, action, args, registry)
      .then((result) => res.json({ success: true, result }))
      .catch((error: unknown) => {
        res.status(502).json({ success: false, error: error instanceof Error ? error.message : String(error) });
      });
  });

  router.post("/refresh", (_req: Request, res: Response) => {
    res.json({ devices: registry.listDevices(), timestamp: new Date().toISOString() });
  });

  return router;
}
