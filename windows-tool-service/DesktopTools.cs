using System;
using System.Collections;
using System.Collections.Generic;
using System.ComponentModel;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
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
                case "keyboard.typeText": RequireInteractiveDesktop(); return TypeText(args);
                case "keyboard.keyPress": RequireInteractiveDesktop(); return Press(args);
                case "screenshot.capturePrimaryDisplay": RequireInteractiveDesktop(); return Capture();
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

        /// <summary>Captures the primary display as a base64 PNG.</summary>
        private static object Capture()
        {
            var bounds = Screen.PrimaryScreen.Bounds;
            using (var image = new Bitmap(bounds.Width, bounds.Height, PixelFormat.Format32bppArgb))
            using (var graphics = Graphics.FromImage(image))
            using (var stream = new MemoryStream())
            {
                graphics.CopyFromScreen(bounds.Location, Point.Empty, bounds.Size, CopyPixelOperation.SourceCopy);
                image.Save(stream, ImageFormat.Png);

                var result = Result();
                result["format"] = "png";
                result["base64Data"] = Convert.ToBase64String(stream.ToArray());
                result["width"] = bounds.Width;
                result["height"] = bounds.Height;
                return result;
            }
        }

        /// <summary>Lists every visible, titled top-level window with its bounds and focus.</summary>
        private static object Windows()
        {
            var windows = new List<object>();
            var foreground = GetForegroundWindow();

            EnumWindow callback = delegate(IntPtr handle, IntPtr parameter)
            {
                if (!IsWindowVisible(handle)) return true;

                var title = new StringBuilder(GetWindowTextLength(handle) + 1);
                GetWindowText(handle, title, title.Capacity);

                Rect bounds;
                if (title.Length > 0 && GetWindowRect(handle, out bounds))
                    windows.Add(new
                    {
                        title = title.ToString(),
                        x = bounds.Left,
                        y = bounds.Top,
                        width = bounds.Right - bounds.Left,
                        height = bounds.Bottom - bounds.Top,
                        isFocused = handle == foreground
                    });
                return true;
            };

            if (!EnumWindows(callback, IntPtr.Zero)) throw new Win32Exception();

            var result = Result();
            result["windows"] = windows;
            return result;
        }

        // ── SendInput plumbing ───────────────────────────────────────────────────────

        private static Input KeyInput(ushort key, ushort scan, uint flags)
        {
            return new Input { Type = 1, Data = new InputUnion { Keyboard = new KeyboardInput { VirtualKey = key, Scan = scan, Flags = flags } } };
        }

        private static Input MouseInput(uint flags)
        {
            return new Input { Type = 0, Data = new InputUnion { Mouse = new MouseData { Flags = flags } } };
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
        [DllImport("user32.dll", SetLastError = true)] private static extern IntPtr OpenInputDesktop(uint flags, bool inherit, uint access);
        [DllImport("user32.dll")] private static extern bool SwitchDesktop(IntPtr desktop);
        [DllImport("user32.dll")] private static extern bool CloseDesktop(IntPtr desktop);
    }
}