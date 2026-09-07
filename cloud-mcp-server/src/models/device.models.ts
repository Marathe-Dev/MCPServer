export interface DeviceListResult {
  success: boolean;
  devices: Array<{ deviceId: string; deviceName: string }>;
  timestamp: string;
}
