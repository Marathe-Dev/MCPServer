using System.Collections.Generic;
using System.ComponentModel;
using System.Windows.Forms;

namespace WindowsToolService
{
    /// <summary>Mouse tool handlers: move, click, scroll and drag in virtual-desktop pixels.</summary>
    internal sealed partial class DesktopTools
    {
        /// <summary>Moves the cursor, and optionally clicks, at a virtual-desktop pixel.</summary>
        private object Move(IDictionary<string, object> args, bool click)
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
        private object Scroll(IDictionary<string, object> args)
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
        private object Drag(IDictionary<string, object> args)
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
    }
}
