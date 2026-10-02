using System;
using System.Collections.Generic;
using System.Drawing;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace WindowsToolService
{
    /// <summary>
    /// Single entry point for every relay tool. <see cref="CallAsync"/> routes each
    /// tool name to its handler. The per-tool logic lives in the partial files under
    /// <c>tools/</c> (mouse, keyboard, screenshot, window list); shared dispatch,
    /// the SendInput plumbing and the Win32 interop stay here.
    /// </summary>
    internal sealed partial class DesktopTools
    {
        // ── State ─────────────────────────────────────────────────────────────────────
        private readonly AgentConfig _config;
        private readonly WinPtyCommand _command = new WinPtyCommand();

        internal DesktopTools(AgentConfig config)
        {
            _config = config;
        }

        // ── Dispatch ──────────────────────────────────────────────────────────────

        /// <summary>Routes one relay tool call to its handler and returns the result.</summary>
        internal async Task<object> CallAsync(string tool, IDictionary<string, object> args, CancellationToken token)
        {
            switch (tool)
            {
                // Remote command execution — opt-in; WinPTY runs its own desktop check.
                case "RemoteCMD":
                    if (!_config.EnableCmd)
                        throw new InvalidOperationException("CMD is disabled. Enable remote CMD in the agent window.");
                    return await _command.ExecuteAsync(args, token).ConfigureAwait(false);

                // File read — no desktop required; always uploads to storage and returns a URL, never inline bytes.
                case "RemoteGetFile":
                    if (!_config.StorageEnabled)
                        throw new InvalidOperationException("Storage is not configured on this device. Configure storage to use RemoteGetFile.");
                    return await UploadFileAsync(args, token).ConfigureAwait(false);

                // Desktop input / capture — needs an unlocked, interactive desktop.
                case "RemoteMouse":
                {
                    RequireInteractiveDesktop();
                    var action = Arguments.Text(args, "action", 20);
                    switch (action)
                    {
                        case "move": return Move(args, click: false);
                        case "click": return Move(args, click: true);
                        case "scroll": return Scroll(args);
                        case "drag": return Drag(args);
                        default: throw new ArgumentException("Unsupported mouse action: " + action);
                    }
                }
                case "RemoteKeyboard":
                {
                    RequireInteractiveDesktop();
                    var action = Arguments.Text(args, "action", 20);
                    switch (action)
                    {
                        case "type": return TypeText(args);
                        case "press": return Press(args);
                        default: throw new ArgumentException("Unsupported keyboard action: " + action);
                    }
                }
                case "RemoteScreenshot": RequireInteractiveDesktop(); return await CaptureAsync(args, token).ConfigureAwait(false);
                case "RemoteWindowsList": RequireInteractiveDesktop(); return Windows(args);

                // Chat — view-only window for the host user; no desktop lock check (must still work on a locked screen).
                case "RemoteChatMessage": return SendChatMessage(args);

                // Restart — opt-in, separate from CMD; no desktop required (must work on a locked/logged-out machine).
                case "RemoteRestart":
                    if (!_config.EnableRestart)
                        throw new InvalidOperationException("Restart is disabled. Enable remote restart in the agent window.");
                    return Restart(args);

                default:
                    throw new ArgumentException("Unsupported tool: " + tool);
            }
        }

        /// <summary>Throws if the session is locked or on a secure desktop.</summary>
        internal void RequireInteractiveDesktop()
        {
            var desktop = OpenInputDesktop(0, false, 0x0100);
            if (desktop == IntPtr.Zero)
                throw new InvalidOperationException("Desktop unavailable or locked. Unlock the signed-in session first.");
            try
            {
                if (!SwitchDesktop(desktop))
                    throw new InvalidOperationException("Input is unavailable on a locked or secure desktop.");
            }
            finally { CloseDesktop(desktop); }
        }

        /// <summary>Common success envelope shared by every desktop result.</summary>
        private Dictionary<string, object> Result()
        {
            return new Dictionary<string, object>
            {
                { "success", true },
                { "backend", "win32" },
                { "timestamp", DateTime.UtcNow.ToString("o") }
            };
        }

        // ── SendInput plumbing ───────────────────────────────────────────────────────

        private Input KeyInput(ushort key, ushort scan, uint flags)
        {
            return new Input { Type = 1, Data = new InputUnion { Keyboard = new KeyboardInput { VirtualKey = key, Scan = scan, Flags = flags } } };
        }

        private Input MouseInput(uint flags)
        {
            return MouseInput(flags, 0);
        }

        private Input MouseInput(uint flags, uint data)
        {
            return new Input { Type = 0, Data = new InputUnion { Mouse = new MouseData { Flags = flags, MouseDataValue = data } } };
        }

        private void Send(Input[] inputs)
        {
            if (SendInput((uint)inputs.Length, inputs, Marshal.SizeOf(typeof(Input))) != inputs.Length)
                throw new InvalidOperationException("Windows rejected input. The target may be elevated or on a secure desktop.");
        }

        // ── Win32 interop ───────────────────────────────────────────────────────────

        [StructLayout(LayoutKind.Sequential)] private struct Input { public uint Type; public InputUnion Data; }
        [StructLayout(LayoutKind.Explicit)] private struct InputUnion
        {
            [FieldOffset(0)] public MouseData Mouse;
            [FieldOffset(0)] public KeyboardInput Keyboard;
        }
        [StructLayout(LayoutKind.Sequential)] private struct MouseData
        {
            public int X, Y;
            public uint MouseDataValue, Flags, Time;
            public UIntPtr ExtraInfo;
        }
        [StructLayout(LayoutKind.Sequential)] private struct KeyboardInput
        {
            public ushort VirtualKey, Scan;
            public uint Flags, Time;
            public UIntPtr ExtraInfo;
        }
        [StructLayout(LayoutKind.Sequential)] private struct Rect { public int Left, Top, Right, Bottom; }
        [StructLayout(LayoutKind.Sequential)] private struct CursorInfo { public int Size; public int Flags; public IntPtr Cursor; public Point ScreenPos; }
        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
        private struct DisplayDevice
        {
            public int cb;
            [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)] public string DeviceName;
            [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 128)] public string DeviceString;
            public int StateFlags;
            [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 128)] public string DeviceID;
            [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 128)] public string DeviceKey;
        }
        private delegate bool EnumWindow(IntPtr handle, IntPtr parameter);

        private const int CURSOR_SHOWING = 0x1;
        private const int DI_NORMAL = 0x3;
        private const int MONITOR_DEFAULTTONEAREST = 2;
        private const int MDT_EFFECTIVE_DPI = 0;
        private const int DWMWA_CLOAKED = 14;

        [DllImport("user32.dll", SetLastError = true)] private static extern bool SetCursorPos(int x, int y);
        [DllImport("user32.dll", SetLastError = true)] private static extern uint SendInput(uint count, Input[] inputs, int size);
        [DllImport("user32.dll", SetLastError = true)] private static extern bool EnumWindows(EnumWindow callback, IntPtr parameter);
        [DllImport("user32.dll")] private static extern bool IsWindowVisible(IntPtr handle);
        [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern int GetWindowTextLength(IntPtr handle);
        [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern int GetWindowText(IntPtr handle, StringBuilder text, int maximum);
        [DllImport("user32.dll")] private static extern bool GetWindowRect(IntPtr handle, out Rect bounds);
        [DllImport("user32.dll")] private static extern IntPtr GetForegroundWindow();
        [DllImport("user32.dll", SetLastError = true)] private static extern uint GetWindowThreadProcessId(IntPtr handle, out uint processId);
        [DllImport("user32.dll")] private static extern bool IsIconic(IntPtr handle);
        [DllImport("user32.dll")] private static extern bool IsZoomed(IntPtr handle);
        [DllImport("user32.dll", EntryPoint = "GetWindowLongPtrW", SetLastError = true)] private static extern IntPtr GetWindowLongPtr64(IntPtr handle, int index);
        [DllImport("user32.dll", EntryPoint = "GetWindowLongW", SetLastError = true)] private static extern int GetWindowLong32(IntPtr handle, int index);
        [DllImport("user32.dll", SetLastError = true)] private static extern IntPtr OpenInputDesktop(uint flags, bool inherit, uint access);
        [DllImport("user32.dll")] private static extern bool SwitchDesktop(IntPtr desktop);
        [DllImport("user32.dll")] private static extern bool CloseDesktop(IntPtr desktop);
        [DllImport("user32.dll")] private static extern bool GetCursorInfo(out CursorInfo info);
        [DllImport("user32.dll")] private static extern bool DrawIconEx(IntPtr hdc, int x, int y, IntPtr icon, int width, int height, int frame, IntPtr flickerFreeDraw, int flags);
        [DllImport("user32.dll")] private static extern IntPtr MonitorFromRect(ref Rect rect, int flags);
        [DllImport("user32.dll")] private static extern bool IsWindow(IntPtr handle);
        [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern bool EnumDisplayDevices(string device, uint deviceNumber, ref DisplayDevice info, uint flags);
        [DllImport("dwmapi.dll")] private static extern int DwmGetWindowAttribute(IntPtr handle, int attribute, out int value, int size);
        [DllImport("shcore.dll")] private static extern int GetDpiForMonitor(IntPtr monitor, int dpiType, out uint dpiX, out uint dpiY);
    }
}
