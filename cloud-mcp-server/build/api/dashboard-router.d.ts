import { Router } from "express";
import type { DeviceRegistry } from "../relay/device-registry.js";
/**
 * REST API consumed by the dashboard UI (and, indirectly, the show_dashboard
 * MCP tool's HTML widget). Every route reads from / dispatches through the
 * same `DeviceRegistry` the MCP tools use — no separate state.
 */
export declare function createDashboardRouter(registry: DeviceRegistry): Router;
