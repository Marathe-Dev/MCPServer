import { Router } from "express";
import * as z from "zod/v4";
import { performAction } from "../services/action-dispatcher.js";
const ACTION_NAMES = [
    "screenshot",
    "mouse_move",
    "mouse_click",
    "type_text",
    "key_press",
    "get_window_list",
];
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
export function createDashboardRouter(registry) {
    const router = Router();
    router.get("/devices", (_req, res) => {
        res.json({ devices: registry.listDevices(), timestamp: new Date().toISOString() });
    });
    router.get("/device-status/:deviceId", (req, res) => {
        const device = registry.getDevice(req.params.deviceId);
        if (!device) {
            res.status(404).json({ error: `Unknown device "${req.params.deviceId}"` });
            return;
        }
        res.json(device);
    });
    router.post("/action", (req, res) => {
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
            .catch((error) => {
            res.status(502).json({ success: false, error: error instanceof Error ? error.message : String(error) });
        });
    });
    router.post("/refresh", (_req, res) => {
        res.json({ devices: registry.listDevices(), timestamp: new Date().toISOString() });
    });
    return router;
}
