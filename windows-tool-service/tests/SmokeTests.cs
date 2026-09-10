using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Threading;

namespace WindowsToolService
{
    internal static class SmokeTests
    {
        private static int checks;

        [STAThread]
        private static int Main(string[] args)
        {
            try
            {
                if (args.Length == 2 && args[0] == "--handshake")
                {
                    Console.WriteLine("Default TLS protocols: " + System.Net.ServicePointManager.SecurityProtocol);
                    ProbeHandshakeAsync(args[1]).GetAwaiter().GetResult();
                    new RelayClient(new AgentConfig(), (tool, arguments, token) => Task.FromResult<object>(null), Console.WriteLine);
                    Assert(System.Net.ServicePointManager.SecurityProtocol == System.Net.SecurityProtocolType.Tls12, "relay enables TLS 1.2");
                    Console.WriteLine("Relay TLS configuration probe:");
                    ProbeHandshakeAsync(args[1]).GetAwaiter().GetResult();
                    return 0;
                }
                if (args.Length == 2 && args[0] == "--relay")
                {
                    RelayAsync(args[1]).GetAwaiter().GetResult();
                    return 0;
                }
                Assert(typeof(AgentConfig).Assembly.GetCustomAttributes(typeof(System.Runtime.Versioning.TargetFrameworkAttribute), false)
                    .Cast<System.Runtime.Versioning.TargetFrameworkAttribute>().Single().FrameworkName == ".NETFramework,Version=v4.5", "exact framework target");
                Assert(Marshal.SizeOf(typeof(DesktopTools).GetNestedType("Input", System.Reflection.BindingFlags.NonPublic)) == (IntPtr.Size == 8 ? 40 : 28), "SendInput layout for current process architecture");
                Assert(DesktopTools.ResolveKey("CTRL") == 162 && DesktopTools.ResolveKey("rctrl") == 163, "key aliases");
                Assert(DesktopTools.ResolveKey("F24") == 135 && DesktopTools.ResolveKey("z") == 90, "function and letter keys");
                Reject(() => DesktopTools.ResolveKey("unknown"), "unsupported key rejection");
                var config = new AgentConfig { CloudUrl = "ws://127.0.0.1:4000", DeviceId = "test", DeviceName = "test" };
                config.Validate();
                config.CloudUrl = "ws://example.com";
                Reject(config.Validate, "insecure remote relay rejection");
                config.CloudUrl = "wss://example.com";
                config.Validate();
                config.DeviceId = "";
                Reject(config.Validate, "empty device ID rejection");
                var dictionary = new JavaScriptSerializer().Deserialize<Dictionary<string, object>>("{\"x\":3,\"timeoutMs\":1.5}");
                Assert(Arguments.Integer(dictionary, "x", 0, 10) == 3, "integer JSON arguments");
                Reject(() => Arguments.Integer(dictionary, "timeoutMs", 1, 10), "fractional integer rejection");
                var serializer = new JavaScriptSerializer();
                var legacy = serializer.Deserialize<AgentConfig>("{\"DeviceId\":\"saved-device\",\"DeviceName\":\"Saved name\",\"EnableCmd\":true,\"ConnectOnServiceLaunch\":true}");
                Assert(!legacy.AutoConnectOnStartup && legacy.DeviceId == "saved-device" && legacy.DeviceName == "Saved name" && legacy.EnableCmd,
                    "legacy settings preserved without enabling startup connections");
                var startup = serializer.Deserialize<AgentConfig>(serializer.Serialize(new AgentConfig { AutoConnectOnStartup = true }));
                Assert(startup.AutoConnectOnStartup, "startup preference round trip");
                new RelayClient(config, (tool, arguments, token) => Task.FromResult<object>(null), Console.WriteLine);
                Assert(System.Net.ServicePointManager.SecurityProtocol == System.Net.SecurityProtocolType.Tls12, "relay enables TLS 1.2");
                var fileArgs = new Dictionary<string, object> { { "path", "relative\\path.txt" } };
                Reject(() => FileTools.Read(fileArgs), "relative file path rejection");
                var missing = new Dictionary<string, object> { { "path", @"C:\Windows\this-file-does-not-exist.smoketest" } };
                try { FileTools.Read(missing); throw new Exception("Expected file rejection."); }
                catch (FileNotFoundException) { Assert(true, "missing file rejection"); }
                var tempFile = Path.Combine(Path.GetTempPath(), "windows-tool-service-file-tools-" + Guid.NewGuid().ToString("N") + ".bin");
                try
                {
                    File.WriteAllBytes(tempFile, new byte[] { 0x4d, 0x43, 0x50, 0x00 });
                    var read = (Dictionary<string, object>)FileTools.Read(new Dictionary<string, object> { { "path", tempFile } });
                    Assert((bool)read["success"] && (int)read["size"] == 4 && (string)read["base64Data"] == "TUNQAA==", "FileTools reads a small file");
                }
                finally { try { File.Delete(tempFile); } catch { } }
                var oversized = Path.Combine(Path.GetTempPath(), "windows-tool-service-oversize-" + Guid.NewGuid().ToString("N") + ".bin");
                try
                {
                    using (var stream = new FileStream(oversized, FileMode.CreateNew, FileAccess.Write)) { stream.SetLength(FileTools.MaxFileBytes + 1); }
                    Reject(() => FileTools.Read(new Dictionary<string, object> { { "path", oversized } }), "10 MB file size rejection");
                }
                finally { try { File.Delete(oversized); } catch { } }

                // DesktopTools is the single switch: it must route cmd + file.read too.
                var router = new DesktopTools(new AgentConfig { CloudUrl = "ws://127.0.0.1:4000", DeviceId = "router", DeviceName = "router", EnableCmd = false });
                try { router.CallAsync("cmd.execute", new Dictionary<string, object> { { "command", "echo hi" } }, CancellationToken.None).GetAwaiter().GetResult(); throw new Exception("Expected CMD rejection."); }
                catch (InvalidOperationException) { Assert(true, "DesktopTools blocks CMD when disabled"); }
                var routedFile = Path.Combine(Path.GetTempPath(), "windows-tool-service-routed-" + Guid.NewGuid().ToString("N") + ".bin");
                try
                {
                    File.WriteAllBytes(routedFile, new byte[] { 0x4d, 0x43, 0x50, 0x00 });
                    var routed = (Dictionary<string, object>)router.CallAsync("file.read", new Dictionary<string, object> { { "path", routedFile } }, CancellationToken.None).GetAwaiter().GetResult();
                    Assert((bool)routed["success"] && (int)routed["size"] == 4, "DesktopTools routes file.read");
                }
                finally { try { File.Delete(routedFile); } catch { } }

                // Logger writes next to the exe and trims when it grows past 1 MB.
                var logFile = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "MCPToolService.Log");
                Log.Write("smoke test log line");
                Assert(File.Exists(logFile) && File.ReadAllText(logFile).Contains("smoke test log line"), "logger writes to exe directory");
                File.WriteAllBytes(logFile, new byte[(1024 * 1024) + 4096]);
                Log.Write("after overflow");
                Assert(new FileInfo(logFile).Length <= 1024 * 1024, "logger trims when oversized");
                if (args.Contains("--native"))
                {
                    NativeAsync().GetAwaiter().GetResult();
                    RenderWindow();
                }
                Console.WriteLine("PASS: " + checks + " checks");
                return 0;
            }
            catch (Exception error) { Console.Error.WriteLine(error); return 1; }
        }

        private static async Task ProbeHandshakeAsync(string endpoint)
        {
            using (var socket = new System.Net.WebSockets.ClientWebSocket())
            using (var cancellation = new CancellationTokenSource(20000))
            {
                try
                {
                    await socket.ConnectAsync(new Uri(endpoint), cancellation.Token);
                    Console.WriteLine("Handshake: " + socket.State);
                }
                catch (Exception error)
                {
                    for (var detail = error; detail != null; detail = detail.InnerException)
                        Console.WriteLine(detail.GetType().Name + ": " + detail.Message);
                }
                finally { socket.Abort(); }
            }
        }

        private static async Task NativeAsync()
        {
            var desktop = new DesktopTools(new AgentConfig { CloudUrl = "ws://127.0.0.1:4000", DeviceId = "native", DeviceName = "native", EnableCmd = true });
            var windows = (Dictionary<string, object>)(await desktop.CallAsync("window.listWindows", new Dictionary<string, object>(), CancellationToken.None));
            Assert((bool)windows["success"], "native window enumeration");
            var windowList = (System.Collections.IList)windows["windows"];
            var windowJson = new JavaScriptSerializer().Serialize(windowList);
            Assert(windowList.Count == 0 || (windowJson.Contains("\"processId\"") && windowJson.Contains("\"displayIndex\"") && windowJson.Contains("\"isMinimized\"")),
                "window list includes process, state and monitor fields");
            var screenshot = (Dictionary<string, object>)(await desktop.CallAsync("screenshot.capturePrimaryDisplay", new Dictionary<string, object> { { "format", "png" } }, CancellationToken.None));
            var image = Convert.FromBase64String((string)screenshot["base64Data"]);
            Assert(image.Length > 8 && image[0] == 137 && image[1] == 80 && (int)screenshot["width"] > 0, "native PNG screenshot");
            Assert(((System.Collections.IList)screenshot["displays"]).Count >= 1 && screenshot.ContainsKey("originX") && screenshot.ContainsKey("scale") && (string)screenshot["mimeType"] == "image/png",
                "screenshot attaches display + coordinate metadata");
            var jpegShot = (Dictionary<string, object>)(await desktop.CallAsync("screenshot.capturePrimaryDisplay", new Dictionary<string, object> { { "format", "jpeg" }, { "quality", 70 } }, CancellationToken.None));
            var jpegBytes = Convert.FromBase64String((string)jpegShot["base64Data"]);
            Assert(jpegBytes.Length > 3 && jpegBytes[0] == 0xFF && jpegBytes[1] == 0xD8 && (string)jpegShot["mimeType"] == "image/jpeg", "screenshot JPEG encoding");
            var scaledShot = (Dictionary<string, object>)(await desktop.CallAsync("screenshot.capturePrimaryDisplay", new Dictionary<string, object> { { "format", "png" }, { "maxWidth", 320 } }, CancellationToken.None));
            Assert((int)scaledShot["width"] <= 320 && Convert.ToDouble(scaledShot["scale"]) <= 1.0, "screenshot downscales to maxWidth");
            var command = new WinPtyCommand();
            var echo = await Execute(command, "echo MCP_WINPTY_OK", 10000);
            Assert((bool)echo["success"] && ((string)echo["output"]).Contains("MCP_WINPTY_OK"), "WinPTY output capture");
            var failed = await Execute(command, "exit /b 7", 10000);
            Assert(!(bool)failed["success"] && Convert.ToInt32(failed["exitCode"]) == 7, "WinPTY exit code");
            var timeout = await Execute(command, "ping -n 10 127.0.0.1 >nul", 500);
            Assert((bool)timeout["timedOut"] && timeout["exitCode"] == null, "WinPTY timeout");
            var bounded = await Execute(command, "for /L %N in (1,1,500) do @echo 12345678901234567890", 10000, 1024);
            Assert((bool)bounded["truncated"] && ((string)bounded["output"]).Length <= 1024, "WinPTY bounded output");
            using (var cancellation = new CancellationTokenSource(500))
            {
                try
                {
                    await command.ExecuteAsync(new Dictionary<string, object> { { "command", "ping -n 10 127.0.0.1 >nul" } }, cancellation.Token);
                    throw new Exception("Cancellation was not observed.");
                }
                catch (OperationCanceledException) { Assert(true, "WinPTY cancellation"); }
            }
            var again = await Execute(command, "echo RECOVERED", 10000);
            Assert((bool)again["success"], "WinPTY recovery after cancellation");
        }

        private static async Task RelayAsync(string url)
        {
            using (var cancellation = new CancellationTokenSource(20000))
            {
                var config = new AgentConfig { CloudUrl = url, DeviceId = "windows-relay-test", DeviceName = "Windows relay test" };
                var relay = new RelayClient(config, async (tool, args, token) =>
                {
                    if (tool == "test.echo") return (object)args;
                    if (tool == "test.wait") { await Task.Delay(500, token); return (object)new { success = true }; }
                    if (tool == "test.stop") { cancellation.CancelAfter(100); return (object)new { success = true }; }
                    if (tool == "cmd.execute") return await new WinPtyCommand().ExecuteAsync(args, token);
                    throw new ArgumentException("Unsupported tool: " + tool);
                }, Console.WriteLine);
                await relay.RunAsync(cancellation.Token);
            }
        }

        private static async Task<Dictionary<string, object>> Execute(WinPtyCommand command, string text, int timeout, int maximum = 65536)
        {
            var result = await command.ExecuteAsync(new Dictionary<string, object>
                { { "command", text }, { "timeoutMs", timeout }, { "maxOutputChars", maximum } }, CancellationToken.None);
            var serializer = new JavaScriptSerializer();
            return serializer.Deserialize<Dictionary<string, object>>(serializer.Serialize(result));
        }

        private static void RenderWindow()
        {
            var application = new Application { ShutdownMode = ShutdownMode.OnExplicitShutdown };
            var window = new MainWindow(new AgentConfig
            {
                CloudUrl = "ws://127.0.0.1:4000", DeviceId = "ui-test", DeviceName = "UI test", EnableCmd = true
            });
            window.Show();
            foreach (var width in new[] { 760, 520 })
            {
                window.Width = width;
                window.Dispatcher.Invoke(new Action(() => { }), DispatcherPriority.ApplicationIdle);
                window.UpdateLayout();
                var bitmap = new RenderTargetBitmap((int)window.ActualWidth, (int)window.ActualHeight, 96, 96, PixelFormats.Pbgra32);
                bitmap.Render(window);
                var encoder = new PngBitmapEncoder();
                encoder.Frames.Add(BitmapFrame.Create(bitmap));
                using (var stream = File.Create(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "wpf-" + width + ".png"))) encoder.Save(stream);
                Assert(window.IsVisible && bitmap.PixelWidth == width, "WPF render width " + width);
            }
            Assert(((System.Windows.Controls.TextBox)window.FindName("cloud")).Text == "ws://127.0.0.1:4000" &&
                ((System.Windows.Controls.TextBlock)window.FindName("state")).Text == "Stopped" &&
                ((System.Windows.Controls.CheckBox)window.FindName("enableCmd")).IsChecked == true,
                "XAML controls load settings without connecting or prompting for restored CMD permission");
            window.Close();
            Assert(!window.IsVisible, "window closes cleanly while disconnected");
            application.Shutdown();
        }

        private static void Reject(Action action, string name)
        {
            try { action(); }
            catch (ArgumentException) { Assert(true, name); return; }
            throw new Exception("Expected rejection: " + name);
        }

        private static void Assert(bool condition, string name)
        {
            if (!condition) throw new Exception("Failed: " + name);
            checks++;
            Console.WriteLine("PASS " + name);
        }
    }
}