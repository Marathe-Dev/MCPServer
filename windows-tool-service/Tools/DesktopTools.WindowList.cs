using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Diagnostics;
using System.Linq;
using System.Text;
using System.Windows.Forms;

namespace WindowsToolService
{
    /// <summary>Window-list tool: enumerates visible top-level windows, filtered and paginated.</summary>
    internal sealed partial class DesktopTools
    {
        private const int WindowListPageSize = 15;

        /// <summary>Lists visible, titled top-level windows with process, state and monitor info, 15 per page.</summary>
        private static object Windows(IDictionary<string, object> args)
        {
            var windows = new List<object>();
            var foreground = GetForegroundWindow();
            var screens = Screen.AllScreens;
            var names = new Dictionary<int, string>();
            var includeMinimized = ArgFlag(args, "includeMinimized");

            EnumWindow callback = delegate(IntPtr handle, IntPtr parameter)
            {
                if (!IsWindowVisible(handle)) return true;
                if ((ExStyle(handle) & 0x00000080) != 0) return true; // skip WS_EX_TOOLWINDOW
                if (!includeMinimized && (IsIconic(handle) || IsCloaked(handle))) return true; // skip minimized + cloaked ghosts

                Rect bounds;
                if (!GetWindowRect(handle, out bounds)) return true;
                var width = bounds.Right - bounds.Left;
                var height = bounds.Bottom - bounds.Top;
                if (width <= 0 || height <= 0) return true;

                var length = GetWindowTextLength(handle);
                if (length == 0) return true;
                var title = new StringBuilder(length + 1);
                GetWindowText(handle, title, title.Capacity);
                if (title.Length == 0) return true;

                uint pid;
                GetWindowThreadProcessId(handle, out pid);
                windows.Add(new
                {
                    windowId = "0x" + handle.ToInt64().ToString("X8"),
                    title = title.ToString(),
                    x = bounds.Left,
                    y = bounds.Top,
                    width = width,
                    height = height,
                    isFocused = handle == foreground,
                    isMinimized = IsIconic(handle),
                    isMaximized = IsZoomed(handle),
                    processId = (int)pid,
                    processName = ProcessName((int)pid, names),
                    displayIndex = DisplayIndex(screens, handle)
                });
                return true;
            };

            if (!EnumWindows(callback, IntPtr.Zero)) throw new Win32Exception();

            var offset = Arguments.Integer(args, "offset", 0, int.MaxValue, 0);
            var page = windows.Skip(offset).Take(WindowListPageSize).ToList();

            var result = Result();
            result["windows"] = page;
            result["total"] = windows.Count;
            result["offset"] = offset;
            result["count"] = page.Count;
            result["hasMore"] = offset + page.Count < windows.Count;
            return result;
        }

        /// <summary>Process name for a pid, cached per enumeration; empty when access is denied.</summary>
        private static string ProcessName(int pid, IDictionary<int, string> cache)
        {
            string name;
            if (cache.TryGetValue(pid, out name)) return name;
            try { using (var process = Process.GetProcessById(pid)) name = process.ProcessName; }
            catch { name = ""; }
            cache[pid] = name;
            return name;
        }

        /// <summary>Index of the monitor a window sits on, matching the screenshot displays[].</summary>
        private static int DisplayIndex(Screen[] screens, IntPtr handle)
        {
            var device = Screen.FromHandle(handle).DeviceName;
            for (var i = 0; i < screens.Length; i++)
                if (screens[i].DeviceName == device) return i;
            return 0;
        }

        /// <summary>Extended window styles, using the pointer-size call that exists on both x86 and x64.</summary>
        private static long ExStyle(IntPtr handle)
        {
            return (IntPtr.Size == 8 ? GetWindowLongPtr64(handle, -20) : (IntPtr)GetWindowLong32(handle, -20)).ToInt64();
        }

        /// <summary>True when a window is DWM-cloaked (e.g. a virtual-desktop or suspended UWP window).</summary>
        private static bool IsCloaked(IntPtr handle)
        {
            int cloaked;
            return DwmGetWindowAttribute(handle, DWMWA_CLOAKED, out cloaked, sizeof(int)) == 0 && cloaked != 0;
        }

        /// <summary>Reads a boolean tool argument, defaulting to false when absent or malformed.</summary>
        private static bool ArgFlag(IDictionary<string, object> args, string name)
        {
            object value;
            return args.TryGetValue(name, out value) && value is bool && (bool)value;
        }
    }
}
