using System;
using System.Collections.Generic;
using System.ComponentModel;
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
    /// <summary>Screenshot tool: captures a display/window region, uploads it, and returns coordinate metadata.</summary>
    internal sealed partial class DesktopTools
    {
        /// <summary>Captures a target region and its metadata; encoded bytes come back via out params (no base64).</summary>
        private Dictionary<string, object> CaptureCore(IDictionary<string, object> args, out byte[] bytes, out string mimeType, out string format)
        {
            var target = Arguments.Choice(args, "target", "primary", "primary", "virtual", "display", "window");
            Rectangle source;
            switch (target)
            {
                case "virtual":
                    source = SystemInformation.VirtualScreen;
                    break;
                case "display":
                    source = ResolveDisplay(args);
                    break;
                case "window":
                    source = ResolveWindow(args);
                    break;
                default:
                    source = Screen.PrimaryScreen.Bounds;
                    break;
            }
            if (source.Width <= 0 || source.Height <= 0) throw new InvalidOperationException("Capture region is empty.");

            // The server picks encoding/size from a detail preset so the model never reasons about JPEG vs PNG.
            var detail = Arguments.Choice(args, "detail", "high", "high", "medium", "low");
            var jpeg = detail == "low";
            var quality = 80;
            var maxWidth = detail == "low" ? 1280 : detail == "medium" ? 1920 : 0;

            using (var full = new Bitmap(source.Width, source.Height, PixelFormat.Format24bppRgb))
            {
                using (var graphics = Graphics.FromImage(full))
                {
                    graphics.CopyFromScreen(source.Location, Point.Empty, source.Size, CopyPixelOperation.SourceCopy);
                    DrawCursor(graphics, source);
                }

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

                    using (var stream = new MemoryStream())
                    {
                        if (jpeg) SaveJpeg(encoded, stream, quality);
                        else encoded.Save(stream, ImageFormat.Png);
                        bytes = stream.ToArray();
                    }

                    format = jpeg ? "jpeg" : "png";
                    mimeType = jpeg ? "image/jpeg" : "image/png";
                    var result = Result();
                    result["format"] = format;
                    result["mimeType"] = mimeType;
                    result["width"] = encoded.Width;
                    result["height"] = encoded.Height;
                    // Explicit image->screen mapping: screenX = coordinateSpace.screenX + imageX * scaleX (scaleX = 1 when not downscaled).
                    result["coordinateSpace"] = new
                    {
                        imageWidth = encoded.Width,
                        imageHeight = encoded.Height,
                        screenX = source.X,
                        screenY = source.Y,
                        screenWidth = source.Width,
                        screenHeight = source.Height,
                        scaleX = (double)source.Width / encoded.Width,
                        scaleY = (double)source.Height / encoded.Height
                    };
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

        /// <summary>Captures a screenshot and uploads it to storage; always returns a URL, never inline bytes.</summary>
        private async Task<object> CaptureAsync(IDictionary<string, object> args, CancellationToken token)
        {
            if (!_config.StorageEnabled)
                throw new InvalidOperationException("Storage is not configured on this device. Configure storage to use RemoteScreenshot.");

            byte[] bytes;
            string mimeType, format;
            var result = CaptureCore(args, out bytes, out mimeType, out format);
            var key = "screenshots/" + _config.DeviceId + "/" + Guid.NewGuid().ToString("N") + "." + (format == "jpeg" ? "jpg" : "png");
            result["uploaded"] = true;
            result["size"] = bytes.Length;
            result["url"] = await new S3Presigner(_config).UploadAsync(key, bytes, mimeType, _config.StorageGetTtlSeconds, token).ConfigureAwait(false);
            return result;
        }

        /// <summary>Draws the real system cursor onto the capture so the agent can confirm pointer position visually.</summary>
        private void DrawCursor(Graphics graphics, Rectangle source)
        {
            CursorInfo info;
            info.Size = Marshal.SizeOf(typeof(CursorInfo));
            if (!GetCursorInfo(out info) || info.Flags != CURSOR_SHOWING) return;
            if (!source.Contains(info.ScreenPos)) return;

            var hdc = graphics.GetHdc();
            try { DrawIconEx(hdc, info.ScreenPos.X - source.X, info.ScreenPos.Y - source.Y, info.Cursor, 0, 0, 0, IntPtr.Zero, DI_NORMAL); }
            finally { graphics.ReleaseHdc(hdc); }
        }

        /// <summary>Metadata for every display so the agent can map screenshot pixels to input coordinates.</summary>
        private List<object> Displays()
        {
            var displays = new List<object>();
            var screens = Screen.AllScreens;
            for (var i = 0; i < screens.Length; i++)
            {
                var b = screens[i].Bounds;
                displays.Add(new { index = i, displayId = screens[i].DeviceName, name = DisplayName(screens[i].DeviceName), x = b.X, y = b.Y, width = b.Width, height = b.Height, isPrimary = screens[i].Primary, dpi = MonitorDpi(b) });
            }
            return displays;
        }

        /// <summary>Resolves a display capture rect from a stable displayId (DeviceName), falling back to displayIndex.</summary>
        private Rectangle ResolveDisplay(IDictionary<string, object> args)
        {
            var screens = Screen.AllScreens;
            if (args.ContainsKey("displayId"))
            {
                var id = Arguments.Text(args, "displayId", 64);
                foreach (var s in screens) if (s.DeviceName == id) return s.Bounds;
                throw new ArgumentException("No display with id: " + id);
            }
            return screens[Arguments.Integer(args, "displayIndex", 0, screens.Length - 1, 0)].Bounds;
        }

        /// <summary>Resolves a window capture rect from a stable windowId (HWND hex), falling back to a title substring.</summary>
        private Rectangle ResolveWindow(IDictionary<string, object> args)
        {
            if (args.ContainsKey("windowId"))
            {
                var handle = ParseHandle(Arguments.Text(args, "windowId", 32));
                if (!IsWindow(handle)) throw new ArgumentException("No window with that windowId (it may have closed).");
                Rect r;
                if (!GetWindowRect(handle, out r)) throw new Win32Exception();
                return Rectangle.FromLTRB(r.Left, r.Top, r.Right, r.Bottom);
            }
            return WindowRect(Arguments.Text(args, "windowTitle", 512));
        }

        /// <summary>Parses a "0x..." (or bare hex) window handle from get_window_list.</summary>
        private IntPtr ParseHandle(string id)
        {
            var hex = id.StartsWith("0x") || id.StartsWith("0X") ? id.Substring(2) : id;
            long value;
            if (!long.TryParse(hex, System.Globalization.NumberStyles.HexNumber, System.Globalization.CultureInfo.InvariantCulture, out value))
                throw new ArgumentException("windowId must be a hex handle like 0x000A1234.");
            return new IntPtr(value);
        }

        /// <summary>Friendly monitor/adapter name for a device, or the device name if unavailable.</summary>
        private string DisplayName(string deviceName)
        {
            var info = new DisplayDevice { cb = Marshal.SizeOf(typeof(DisplayDevice)) };
            return EnumDisplayDevices(deviceName, 0, ref info, 0) && info.DeviceString.Length > 0 ? info.DeviceString : deviceName;
        }

        /// <summary>Effective DPI for the monitor covering this rect; diagnostic only now that PerMonitorV2 keeps coordinates consistent.</summary>
        private int MonitorDpi(Rectangle bounds)
        {
            var rect = new Rect { Left = bounds.Left, Top = bounds.Top, Right = bounds.Right, Bottom = bounds.Bottom };
            var monitor = MonitorFromRect(ref rect, MONITOR_DEFAULTTONEAREST);
            uint dpiX, dpiY;
            return GetDpiForMonitor(monitor, MDT_EFFECTIVE_DPI, out dpiX, out dpiY) == 0 ? (int)dpiX : 96;
        }

        /// <summary>Encodes a bitmap as JPEG at the given quality using the built-in GDI+ encoder.</summary>
        private void SaveJpeg(Bitmap image, Stream stream, int quality)
        {
            var codec = ImageCodecInfo.GetImageEncoders().First(c => c.FormatID == ImageFormat.Jpeg.Guid);
            using (var parameters = new EncoderParameters(1))
            {
                parameters.Param[0] = new EncoderParameter(System.Drawing.Imaging.Encoder.Quality, (long)quality);
                image.Save(stream, codec, parameters);
            }
        }

        /// <summary>Finds the on-screen rectangle of the best-matching visible window by title (prefers focused).</summary>
        private Rectangle WindowRect(string title)
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
    }
}
