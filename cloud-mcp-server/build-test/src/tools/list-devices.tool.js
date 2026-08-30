import * as z from "zod/v4";
/**
 * `list_devices` — lists the deviceName of every currently connected Local
 * Tool Service, so an agent can discover valid targets for the other tools.
 */
export function registerListDevicesTool(server, deviceRegistry) {
    server.registerTool("list_devices", {
        description: "List the deviceName of every currently connected desktop (Local Tool Service)",
        inputSchema: z.object({}),
    }, async () => {
        const result = {
            success: true,
            devices: deviceRegistry.listConnectedDeviceIds(),
            timestamp: new Date().toISOString(),
        };
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
    });
}
