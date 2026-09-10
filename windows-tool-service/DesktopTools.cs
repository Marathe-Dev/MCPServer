using System;
using System.Collections;
using System.Collections.Generic;
using System.ComponentModel;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace WindowsToolService
{
    /// <summary>
    /// Single entry point for every relay tool. <see cref="CallAsync"/> routes each
    /// tool name to its handler: Win32 desktop input, a screenshot, the window list,
    /// a WinPTY command, or a file read.
    /// </summary>
    internal sealed class DesktopTools
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
                case "cmd.execute":
                    if (!_config.EnableCmd)
                        throw new InvalidOperationException("CMD is disabled. Enable remote CMD in the agent window.");
                    return await _command.ExecuteAsync(args, token).ConfigureAwait(false);

                // File read — no desktop required.
                case "file.read":
                    return FileTools.Read(args);

                // Desktop input / capture — needs an unlocked, interactive desktop.
                case "mouse.move":  RequireInteractiveDesktop(); return Move(args, click: false);
                case "mouse.click": RequireInteractiveDesktop(); return Move(args, click: true);
                case "mouse.scroll": RequireInteractiveDesktop(); return Scroll(args);
                case "mouse.drag": RequireInteractiveDesktop(); return Drag(args);
                case "keyboard.typeText": RequireInteractiveDesktop(); return TypeText(args);
                case "keyboard.keyPress": RequireInteractiveDesktop(); return Press(args);
                case "screenshot.capturePrimaryDisplay": RequireInteractiveDesktop(); return Capture(args);
                case "window.listWindows": RequireInteractiveDesktop(); return Windows();

                default:
                    throw new ArgumentException("Unsupported tool: " + tool);
            }
        }

        /// <summary>Throws if the session is locked or on a secure desktop.</summary>
        internal static void RequireInteractiveDesktop()
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

        // ── Tool handlers ──────────────────────────────────────────────────────────

        /// <summary>Common success envelope shared by every desktop result.</summary>
        private static Dictionary<string, object> Result()
        {
            return new Dictionary<string, object>
            {
                { "success", true },
                { "backend", "win32" },
                { "timestamp", DateTime.UtcNow.ToString("o") }
            };
        }

        /// <summary>Moves the cursor, and optionally clicks, at a virtual-desktop pixel.</summary>
        private static object Move(IDictionary<string, object> args, bool click)
        {
            var bounds = SystemInformation.VirtualScreen;
            var x = Arguments.Integer(args, "x", bounds.Left, bounds.Right - 1);
            var y = Arguments.Integer(args, "y", bounds.Top, bounds.Bottom - 1);
            var button = Arguments.Choice(args, "button", "left", "left", "right");
            var clickType = Arguments.Choice(args, "clickType", "single", "single", "double");

            if (!SetCursorPos(x, y)) throw new Win32Exception();

            if (click)
            {
                var down = button == "right" ? 0x0008u : 0x0002u;
                for (var i = 0; i < (clickType == "double" ? 2 : 1); i++)
                    Send(new[] { MouseInput(down), MouseInput(down * 2) });
            }

            var result = Result();
            result["x"] = x;
            result["y"] = y;
            return result;
        }

        /// <summary>Scrolls the wheel by whole notches (optionally after moving to a point).</summary>
        private static object Scroll(IDictionary<string, object> args)
        {
            var bounds = SystemInformation.VirtualScreen;
            if (args.ContainsKey("x") && args.ContainsKey("y"))
            {
                var px = Arguments.Integer(args, "x", bounds.Left, bounds.Right - 1);
                var py = Arguments.Integer(args, "y", bounds.Top, bounds.Bottom - 1);
                if (!SetCursorPos(px, py)) throw new Win32Exception();
            }

            var amount = Arguments.Integer(args, "amount", -100, 100);
            var axis = Arguments.Choice(args, "axis", "vertical", "vertical", "horizontal");
            var flags = axis == "horizontal" ? 0x1000u : 0x0800u; // MOUSEEVENTF_HWHEEL : MOUSEEVENTF_WHEEL
            Send(new[] { MouseInput(flags, unchecked((uint)(amount * 120))) });

            var result = Result();
            result["amount"] = amount;
            result["axis"] = axis;
            return result;
        }

        /// <summary>Holds a button at a start point, moves to an end point, and releases (a drag).</summary>
        private static object Drag(IDictionary<string, object> args)
        {
            var bounds = SystemInformation.VirtualScreen;
            var x = Arguments.Integer(args, "x", bounds.Left, bounds.Right - 1);
            var y = Arguments.Integer(args, "y", bounds.Top, bounds.Bottom - 1);
            var toX = Arguments.Integer(args, "toX", bounds.Left, bounds.Right - 1);
            var toY = Arguments.Integer(args, "toY", bounds.Top, bounds.Bottom - 1);
            var button = Arguments.Choice(args, "button", "left", "left", "right");
            var down = button == "right" ? 0x0008u : 0x0002u;

            if (!SetCursorPos(x, y)) throw new Win32Exception();
            Send(new[] { MouseInput(down) });
            if (!SetCursorPos(toX, toY)) throw new Win32Exception();
            Send(new[] { MouseInput(0x0001) }); // MOUSEEVENTF_MOVE so the target registers the drag
            Send(new[] { MouseInput(down * 2) });

            var result = Result();
            result["x"] = x;
            result["y"] = y;
            result["toX"] = toX;
            result["toY"] = toY;
            return result;
        }

        /// <summary>Types each character as a Unicode key-down/up pair.</summary>
        private static object TypeText(IDictionary<string, object> args)
        {
            var text = Arguments.Text(args, "text", 20000);
            foreach (var character in text)
                Send(new[] { KeyInput(0, character, 4), KeyInput(0, character, 6) });
            return Result();
        }

        /// <summary>Presses the given keys together, then releases them in reverse order.</summary>
        private static object Press(IDictionary<string, object> args)
        {
            object raw;
            if (!args.TryGetValue("keys", out raw) || !(raw is IList))
                throw new ArgumentException("keys must be an array.");

            var names = (IList)raw;
            if (names.Count == 0 || names.Count > 16)
                throw new ArgumentException("Provide between 1 and 16 keys.");

            var keys = new List<ushort>();
            foreach (var name in names)
            {
                if (!(name is string)) throw new ArgumentException("Key names must be strings.");
                keys.Add(ResolveKey((string)name));
            }

            var pressed = new List<ushort>();
            try
            {
                foreach (var key in keys)
                {
                    Send(new[] { KeyInput(key, 0, Extended(key)) });
                    pressed.Add(key);
                }
            }
            finally
            {
                // Always release, newest first, even if a press throws midway.
                var releases = new List<Input>();
                for (var i = pressed.Count - 1; i >= 0; i--)
                    releases.Add(KeyInput(pressed[i], 0, Extended(pressed[i]) | 2));
                if (releases.Count > 0) Send(releases.ToArray());
            }
            return Result();
        }

        /// <summary>Maps a key name (letter, digit, F1–F24, or alias) to a virtual-key code.</summary>
        internal static ushort ResolveKey(string name)
        {
            name = name.ToLowerInvariant();

            if (name.Length == 1 && ((name[0] >= 'a' && name[0] <= 'z') || (name[0] >= '0' && name[0] <= '9')))
                return (ushort)char.ToUpperInvariant(name[0]);

            int function;
            if (name.StartsWith("f") && int.TryParse(name.Substring(1), out function) && function >= 1 && function <= 24)
                return (ushort)(0x70 + function - 1);

            ushort key;
            if (!KeyNames.TryGetValue(name, out key))
                throw new ArgumentException("Unsupported key name: " + name);
            return key;
        }

        private static readonly Dictionary<string, ushort> KeyNames = new Dictionary<string, ushort>
        {
            {"ctrl",162},{"control",162},{"lctrl",162},{"rctrl",163},
            {"alt",164},{"lalt",164},{"ralt",165},{"shift",160},{"lshift",160},{"rshift",161},
            {"cmd",91},{"command",91},{"meta",91},{"super",91},{"win",91},{"windows",91},
            {"tab",9},{"enter",13},{"return",13},{"esc",27},{"escape",27},{"space",32},{"spacebar",32},
            {"backspace",8},{"delete",46},{"del",46},{"insert",45},{"ins",45},{"home",36},{"end",35},
            {"pageup",33},{"pgup",33},{"pagedown",34},{"pgdn",34},{"up",38},{"down",40},{"left",37},{"right",39},
            {"capslock",20},{"numlock",144},{"scrolllock",145},{"print",44},{"printscreen",44},{"pause",19},{"menu",93},
            {"-",189},{"=",187},{"[",219},{"]",221},{"\\",220},{";",186},{"'",222},{",",188},{".",190},{"/",191},{"`",192}
        };

        /// <summary>Extended-key flag for the navigation cluster and a few modifiers.</summary>
        private static uint Extended(ushort key)
        {
            return (key >= 33 && key <= 46) || key == 91 || key == 93 || key == 144 || key == 163 || key == 165 ? 1u : 0u;
        }

        private const long AutoPngMaxPixels = 1000000;

        /// <summary>Captures a target region (primary/virtual/display/window) as PNG or JPEG with coordinate metadata.</summary>
        private static object Capture(IDictionary<string, object> args)
        {
            var target = Arguments.Choice(args, "target", "primary", "primary", "virtual", "display", "window");
            Rectangle source;
            switch (target)
            {
                case "virtual":
                    source = SystemInformation.VirtualScreen;
                    break;
                case "display":
                    var screens = Screen.AllScreens;
                    source = screens[Arguments.Integer(args, "displayIndex", 0, screens.Length - 1, 0)].Bounds;
                    break;
                case "window":
                    source = WindowRect(Arguments.Text(args, "windowTitle", 512));
                    break;
                default:
                    source = Screen.PrimaryScreen.Bounds;
                    break;
            }
            if (source.Width <= 0 || source.Height <= 0) throw new InvalidOperationException("Capture region is empty.");

            var format = Arguments.Choice(args, "format", "auto", "auto", "png", "jpeg");
            var quality = Arguments.Integer(args, "quality", 1, 100, 80);
            var maxWidth = args.ContainsKey("maxWidth") ? Arguments.Integer(args, "maxWidth", 16, 10000) : 0;

            using (var full = new Bitmap(source.Width, source.Height, PixelFormat.Format24bppRgb))
            {
                using (var graphics = Graphics.FromImage(full))
                    graphics.CopyFromScreen(source.Location, Point.Empty, source.Size, CopyPixelOperation.SourceCopy);

                var scale = 1.0;
                var encoded = full;
                Bitmap scaled = null;
                try
                {
                    if (maxWidth > 0 && source.Width > maxWidth)
                    {
                        scale = (double)maxWidth / source.Width;
                        var width = maxWidth;
                        var height = Math.Max(1, (int)Math.Round(source.Height * scale));
                        scaled = new Bitmap(width, height, PixelFormat.Format24bppRgb);
                        using (var g = Graphics.FromImage(scaled))
                        {
                            g.InterpolationMode = InterpolationMode.HighQualityBicubic;
                            g.DrawImage(full, 0, 0, width, height);
                        }
                        encoded = scaled;
                    }

                    // Auto keeps small/text frames as lossless PNG and switches large frames to JPEG to cut size.
                    var jpeg = format == "jpeg" || (format == "auto" && (long)encoded.Width * encoded.Height > AutoPngMaxPixels);
                    byte[] bytes;
                    using (var stream = new MemoryStream())
                    {
                        if (jpeg) SaveJpeg(encoded, stream, quality);
                        else encoded.Save(stream, ImageFormat.Png);
                        bytes = stream.ToArray();
                    }

                    var result = Result();
                    result["format"] = jpeg ? "jpeg" : "png";
                    result["mimeType"] = jpeg ? "image/jpeg" : "image/png";
                    result["base64Data"] = Convert.ToBase64String(bytes);
                    result["width"] = encoded.Width;
                    result["height"] = encoded.Height;
                    result["originalWidth"] = source.Width;
                    result["originalHeight"] = source.Height;
                    result["scale"] = scale;
                    result["originX"] = source.X;
                    result["originY"] = source.Y;
                    result["displays"] = Displays();
                    var virtualScreen = SystemInformation.VirtualScreen;
                    result["virtualBounds"] = new { x = virtualScreen.X, y = virtualScreen.Y, width = virtualScreen.Width, height = virtualScreen.Height };
                    var cursor = Cursor.Position;
                    result["cursor"] = new { x = cursor.X, y = cursor.Y };
                    return result;
                }
                finally { if (scaled != null) scaled.Dispose(); }
            }
        }

        /// <summary>Metadata for every display so the agent can map screenshot pixels to input coordinates.</summary>
        private static List<object> Displays()
        {
            var displays = new List<object>();
            var screens = Screen.AllScreens;
            for (var i = 0; i < screens.Length; i++)
            {
                var b = screens[i].Bounds;
                displays.Add(new { index = i, x = b.X, y = b.Y, width = b.Width, height = b.Height, isPrimary = screens[i].Primary });
            }
            return displays;
        }

        /// <summary>Encodes a bitmap as JPEG at the given quality using the built-in GDI+ encoder.</summary>
        private static void SaveJpeg(Bitmap image, Stream stream, int quality)
        {
            var codec = ImageCodecInfo.GetImageEncoders().First(c => c.FormatID == ImageFormat.Jpeg.Guid);
            using (var parameters = new EncoderParameters(1))
            {
                parameters.Param[0] = new EncoderParameter(System.Drawing.Imaging.Encoder.Quality, (long)quality);
                image.Save(stream, codec, parameters);
            }
        }

        /// <summary>Finds the on-screen rectangle of the best-matching visible window by title (prefers focused).</summary>
        private static Rectangle WindowRect(string title)
        {
            var match = IntPtr.Zero;
            var foreground = GetForegroundWindow();
            var wanted = title.ToLowerInvariant();

            EnumWindow callback = delegate(IntPtr handle, IntPtr parameter)
            {
                if (!IsWindowVisible(handle) || GetWindowTextLength(handle) == 0) return true;
                var text = new StringBuilder(GetWindowTextLength(handle) + 1);
                GetWindowText(handle, text, text.Capacity);
                if (text.ToString().ToLowerInvariant().Contains(wanted))
                {
                    if (handle == foreground) { match = handle; return false; }
                    if (match == IntPtr.Zero) match = handle;
                }
                return true;
            };
            EnumWindows(callback, IntPtr.Zero);

            if (match == IntPtr.Zero) throw new ArgumentException("No visible window title contains: " + title);
            Rect rect;
            if (!GetWindowRect(match, out rect)) throw new Win32Exception();
            return Rectangle.FromLTRB(rect.Left, rect.Top, rect.Right, rect.Bottom);
        }

        /// <summary>Lists visible, titled top-level windows with process, state and monitor info.</summary>
        private static object Windows()
        {
            var windows = new List<object>();
            var foreground = GetForegroundWindow();
            var screens = Screen.AllScreens;
            var names = new Dictionary<int, string>();

            EnumWindow callback = delegate(IntPtr handle, IntPtr parameter)
            {
                if (!IsWindowVisible(handle)) return true;
                if ((ExStyle(handle) & 0x00000080) != 0) return true; // skip WS_EX_TOOLWINDOW

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

            var result = Result();
            result["windows"] = windows;
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

        // ── SendInput plumbing ───────────────────────────────────────────────────────

        private static Input KeyInput(ushort key, ushort scan, uint flags)
        {
            return new Input { Type = 1, Data = new InputUnion { Keyboard = new KeyboardInput { VirtualKey = key, Scan = scan, Flags = flags } } };
        }

        private static Input MouseInput(uint flags)
        {
            return MouseInput(flags, 0);
        }

        private static Input MouseInput(uint flags, uint data)
        {
            return new Input { Type = 0, Data = new InputUnion { Mouse = new MouseData { Flags = flags, MouseDataValue = data } } };
        }

        private static void Send(Input[] inputs)
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
        private delegate bool EnumWindow(IntPtr handle, IntPtr parameter);

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
    }
}