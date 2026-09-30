export interface WindowInfo {
  windowId: string;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isFocused: boolean;
  isMinimized: boolean;
  isMaximized: boolean;
  processId: number;
  processName: string;
  displayIndex: number;
}

export interface WindowListResult {
  success: boolean;
  windows: WindowInfo[];
  total: number;
  offset: number;
  count: number;
  hasMore: boolean;
  backend: string;
  timestamp: string;
}
