using System;
using System.Collections;
using System.Collections.Generic;

namespace WindowsToolService
{
    /// <summary>Keyboard tool handlers: type literal text or press a key combination.</summary>
    internal sealed partial class DesktopTools
    {
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
    }
}
