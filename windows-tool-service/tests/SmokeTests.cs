using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Sockets;
using System.Runtime.InteropServices;
using System.Text;
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
                    RelayAsync(new AgentConfig { CloudUrl = args[1], DeviceId = "windows-relay-test", DeviceName = "Windows relay test" }).GetAwaiter().GetResult();
                    return 0;
                }
                if (args.Length == 2 && args[0] == "--pipe")
                {
                    RelayAsync(new AgentConfig { ConnectionMode = "rpc", PipeName = args[1] }).GetAwaiter().GetResult();
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
                Reject(() => { string f, n; FileTools.ReadBytes(fileArgs, out f, out n); }, "relative file path rejection");
                var missing = new Dictionary<string, object> { { "path", @"C:\Windows\this-file-does-not-exist.smoketest" } };
                try { string f, n; FileTools.ReadBytes(missing, out f, out n); throw new Exception("Expected file rejection."); }
                catch (FileNotFoundException) { Assert(true, "missing file rejection"); }
                var tempFile = Path.Combine(Path.GetTempPath(), "windows-tool-service-file-tools-" + Guid.NewGuid().ToString("N") + ".bin");
                try
                {
                    File.WriteAllBytes(tempFile, new byte[] { 0x4d, 0x43, 0x50, 0x00 });
                    string full, name;
                    var data = FileTools.ReadBytes(new Dictionary<string, object> { { "path", tempFile } }, out full, out name);
                    Assert(data.Length == 4 && data[0] == 0x4d && name == Path.GetFileName(tempFile), "FileTools reads a small file");
                }
                finally { try { File.Delete(tempFile); } catch { } }
                var oversized = Path.Combine(Path.GetTempPath(), "windows-tool-service-oversize-" + Guid.NewGuid().ToString("N") + ".bin");
                try
                {
                    using (var stream = new FileStream(oversized, FileMode.CreateNew, FileAccess.Write)) { stream.SetLength(FileTools.MaxFileBytes + 1); }
                    Reject(() => { string f, n; FileTools.ReadBytes(new Dictionary<string, object> { { "path", oversized } }, out f, out n); }, "10 MB file size rejection");
                }
                finally { try { File.Delete(oversized); } catch { } }

                // DesktopTools is the single switch: it must route cmd + file.read too.
                var router = new DesktopTools(new AgentConfig { CloudUrl = "ws://127.0.0.1:4000", DeviceId = "router", DeviceName = "router", EnableCmd = false });
                try { router.CallAsync("cmd.execute", new Dictionary<string, object> { { "command", "echo hi" } }, CancellationToken.None).GetAwaiter().GetResult(); throw new Exception("Expected CMD rejection."); }
                catch (InvalidOperationException) { Assert(true, "DesktopTools blocks CMD when disabled"); }
                // Storage gate is checked before the path even needs to exist.
                try { router.CallAsync("file.read", new Dictionary<string, object> { { "path", @"C:\any.bin" } }, CancellationToken.None).GetAwaiter().GetResult(); throw new Exception("Expected storage-required rejection."); }
                catch (InvalidOperationException) { Assert(true, "DesktopTools requires storage for file.read (no inline base64 backup)"); }

                // Logger writes next to the exe and trims when it grows past 1 MB.
                var logFile = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "MCPToolService.Log");
                Log.Write("smoke test log line");
                Assert(File.Exists(logFile) && File.ReadAllText(logFile).Contains("smoke test log line"), "logger writes to exe directory");
                File.WriteAllBytes(logFile, new byte[(1024 * 1024) + 4096]);
                Log.Write("after overflow");
                Assert(new FileInfo(logFile).Length <= 1024 * 1024, "logger trims when oversized");

                // SigV4 signing key matches AWS's documented example (proves the crypto chain).
                var signingKey = S3Presigner.DeriveSigningKey("wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY", "20120215", "us-east-1", "iam");
                var expectedKey = new byte[] { 0, 74, 168, 6, 225, 61, 174, 136, 185, 3, 45, 146, 97, 188, 176, 76, 103, 208, 35, 175, 173, 210, 33, 230, 176, 210, 6, 225, 118, 14, 11, 94 };
                Assert(signingKey.SequenceEqual(expectedKey), "SigV4 signing key matches AWS example");

                // Presigned upload: agent uploads to storage and returns a credential-free GET URL.
                using (var bucket = new FakeBucket())
                {
                    var storage = new AgentConfig { CloudUrl = "ws://127.0.0.1:4000", DeviceId = "dev", DeviceName = "dev",
                        E2StorageEndpoint = bucket.Endpoint, E2StorageRegion = "us-east-1", E2StorageBucket = "b",
                        E2StorageAccessKey = "AKID", E2StorageSecretKey = "secret", StorageGetTtlSeconds = 900 };
                    Assert(storage.StorageEnabled, "storage enabled when fully configured");

                    var presigned = new S3Presigner(storage).Presign("GET", "a/b c.png", 900);
                    Assert(presigned.Contains("X-Amz-Algorithm=AWS4-HMAC-SHA256") && presigned.Contains("X-Amz-Signature=") && presigned.Contains("b%20c.png"),
                        "presigned URL carries the signature and encoded key");

                    var uploadFile = Path.Combine(Path.GetTempPath(), "wts-upload-" + Guid.NewGuid().ToString("N") + ".bin");
                    File.WriteAllBytes(uploadFile, new byte[] { 1, 2, 3, 4, 5 });
                    try
                    {
                        var tools = new DesktopTools(storage);
                        var uploaded = (Dictionary<string, object>)tools.CallAsync("file.read", new Dictionary<string, object> { { "path", uploadFile } }, CancellationToken.None).GetAwaiter().GetResult();
                        Assert((bool)uploaded["uploaded"] && !uploaded.ContainsKey("base64Data") && ((string)uploaded["url"]).StartsWith(bucket.Endpoint),
                            "file.read uploads and returns a URL");
                        using (var http = new System.Net.Http.HttpClient())
                        {
                            var downloaded = http.GetByteArrayAsync((string)uploaded["url"]).GetAwaiter().GetResult();
                            Assert(downloaded.Length == 5 && downloaded[0] == 1 && downloaded[4] == 5, "presigned URL downloads exact bytes with no credentials");
                        }
                    }
                    finally { try { File.Delete(uploadFile); } catch { } }
                }

                // Broker guard: any result over 500 KB is replaced with an error.
                var capMethod = typeof(RelayClient).GetMethod("CapResult", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static);
                var small = capMethod.Invoke(null, new object[] { new Dictionary<string, object> { { "ok", true } }, "r" });
                var big = capMethod.Invoke(null, new object[] { new Dictionary<string, object> { { "blob", new string('x', 600 * 1024) } }, "r" });
                Assert(small == null && big != null, "relay guards results over 500 KB");
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

            // Screenshot always returns inline base64 (no storage required).
            var screenshot = (Dictionary<string, object>)(await desktop.CallAsync("screenshot.capture", new Dictionary<string, object> { { "format", "png" } }, CancellationToken.None));
            var image = Convert.FromBase64String((string)screenshot["base64Data"]);
            Assert(image.Length > 8 && image[0] == 137 && image[1] == 80 && (int)screenshot["width"] > 0, "native PNG screenshot");
            Assert(((System.Collections.IList)screenshot["displays"]).Count >= 1 && screenshot.ContainsKey("originX") && screenshot.ContainsKey("scale") && (string)screenshot["mimeType"] == "image/png",
                "screenshot attaches display + coordinate metadata");

            var jpegShot = (Dictionary<string, object>)(await desktop.CallAsync("screenshot.capture", new Dictionary<string, object> { { "format", "jpeg" }, { "quality", 70 } }, CancellationToken.None));
            var jpegBytes = Convert.FromBase64String((string)jpegShot["base64Data"]);
            Assert(jpegBytes.Length > 3 && jpegBytes[0] == 0xFF && jpegBytes[1] == 0xD8 && (string)jpegShot["mimeType"] == "image/jpeg", "screenshot JPEG encoding");

            var scaledShot = (Dictionary<string, object>)(await desktop.CallAsync("screenshot.capture", new Dictionary<string, object> { { "format", "png" }, { "maxWidth", 320 } }, CancellationToken.None));
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

            try { await command.ExecuteAsync(new Dictionary<string, object> { { "command", "echo x" }, { "maxOutputChars", 500000 } }, CancellationToken.None); throw new Exception("Expected cap rejection."); }
            catch (ArgumentException) { Assert(true, "WinPTY maxOutputChars capped at 400000"); }
        }

        private static async Task RelayAsync(AgentConfig config)
        {
            using (var cancellation = new CancellationTokenSource(20000))
            {
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

        /// <summary>Loopback HTTP server standing in for the S3-compatible bucket in upload tests.</summary>
        private sealed class FakeBucket : IDisposable
        {
            private readonly TcpListener _listener;
            private readonly Dictionary<string, byte[]> _objects = new Dictionary<string, byte[]>();
            internal string Endpoint { get; private set; }

            internal FakeBucket()
            {
                _listener = new TcpListener(IPAddress.Loopback, 0);
                _listener.Start();
                Endpoint = "http://127.0.0.1:" + ((IPEndPoint)_listener.LocalEndpoint).Port;
                Task.Run(() => AcceptLoop());
            }

            private async Task AcceptLoop()
            {
                while (true)
                {
                    TcpClient client;
                    try { client = await _listener.AcceptTcpClientAsync().ConfigureAwait(false); }
                    catch { return; }
                    try { Handle(client); } catch { }
                }
            }

            private void Handle(TcpClient client)
            {
                using (client)
                using (var stream = client.GetStream())
                {
                    var header = new List<byte>();
                    var one = new byte[1];
                    while (!(header.Count >= 4 && header[header.Count - 4] == 13 && header[header.Count - 3] == 10 && header[header.Count - 2] == 13 && header[header.Count - 1] == 10))
                    {
                        if (stream.Read(one, 0, 1) == 0) return;
                        header.Add(one[0]);
                    }
                    var lines = Encoding.ASCII.GetString(header.ToArray()).Split(new[] { "\r\n" }, StringSplitOptions.None);
                    var request = lines[0].Split(' ');
                    var method = request[0];
                    var path = request.Length > 1 ? request[1] : "/";
                    var query = path.IndexOf('?');
                    if (query >= 0) path = path.Substring(0, query);
                    var contentLength = 0;
                    foreach (var line in lines)
                        if (line.StartsWith("Content-Length:", StringComparison.OrdinalIgnoreCase))
                            int.TryParse(line.Substring(15).Trim(), out contentLength);

                    if (method == "PUT")
                    {
                        var body = new byte[contentLength];
                        var read = 0;
                        while (read < contentLength)
                        {
                            var n = stream.Read(body, read, contentLength - read);
                            if (n == 0) break;
                            read += n;
                        }
                        lock (_objects) _objects[path] = body;
                        Respond(stream, "200 OK", new byte[0]);
                    }
                    else if (method == "GET")
                    {
                        byte[] body;
                        lock (_objects) _objects.TryGetValue(path, out body);
                        Respond(stream, body == null ? "404 Not Found" : "200 OK", body ?? new byte[0]);
                    }
                    else Respond(stream, "405 Method Not Allowed", new byte[0]);
                }
            }

            private static void Respond(NetworkStream stream, string status, byte[] body)
            {
                var head = Encoding.ASCII.GetBytes("HTTP/1.1 " + status + "\r\nContent-Length: " + body.Length + "\r\nConnection: close\r\n\r\n");
                stream.Write(head, 0, head.Length);
                if (body.Length > 0) stream.Write(body, 0, body.Length);
                stream.Flush();
            }

            public void Dispose() { try { _listener.Stop(); } catch { } }
        }
    }
}