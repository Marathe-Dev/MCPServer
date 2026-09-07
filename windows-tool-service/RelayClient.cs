using System;
using System.Collections.Generic;
using System.IO;
using System.Net.WebSockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;

namespace WindowsToolService
{
    internal sealed class RelayClient
    {
        private readonly AgentConfig config;
        private readonly Func<string, IDictionary<string, object>, CancellationToken, Task<object>> dispatch;
        private readonly Action<string> status;
        private readonly SemaphoreSlim sendGate = new SemaphoreSlim(1, 1);
        private readonly SemaphoreSlim actionGate = new SemaphoreSlim(1, 1);

        internal RelayClient(AgentConfig config, Func<string, IDictionary<string, object>, CancellationToken, Task<object>> dispatch, Action<string> status)
        {
            this.config = config;
            this.dispatch = dispatch;
            this.status = status;
        }

        internal async Task RunAsync(CancellationToken cancellation)
        {
            var delay = 1000;
            while (!cancellation.IsCancellationRequested)
            {
                using (var socket = new ClientWebSocket())
                using (var connection = CancellationTokenSource.CreateLinkedTokenSource(cancellation))
                {
                    Task activeCall = Task.FromResult(0);
                    try
                    {
                        status("Connecting");
                        using (var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellation))
                        {
                            timeout.CancelAfter(15000);
                            await socket.ConnectAsync(new Uri(config.CloudUrl.TrimEnd('/') + "/device-link"), timeout.Token).ConfigureAwait(false);
                        }
                        await SendAsync(socket, new { type = "register", deviceId = config.DeviceId, deviceName = config.DeviceName, platform = "win32" }, connection.Token).ConfigureAwait(false);
                        status("Connected");
                        delay = 1000;
                        while (socket.State == WebSocketState.Open && !cancellation.IsCancellationRequested)
                        {
                            var message = await ReceiveAsync(socket, connection.Token).ConfigureAwait(false);
                            if (message == null) break;
                            var type = Arguments.Text(message, "type", 40);
                            if (type == "ping")
                                await SendAsync(socket, new { type = "pong" }, connection.Token).ConfigureAwait(false);
                            else if (type == "tool_call")
                            {
                                var requestId = Arguments.Text(message, "requestId", 200);
                                if (!actionGate.Wait(0))
                                    await SendAsync(socket, new { type = "tool_result", requestId = requestId, ok = false, error = "Agent busy; retry after the current action completes." }, connection.Token).ConfigureAwait(false);
                                else
                                    activeCall = Task.Run(() => HandleAsync(socket, message, requestId, connection.Token));
                            }
                        }
                    }
                    catch (OperationCanceledException) { }
                    catch (Exception error) { status("Connection error: " + error.Message); }
                    finally
                    {
                        connection.Cancel();
                        socket.Abort();
                        await activeCall.ConfigureAwait(false);
                    }
                }
                if (cancellation.IsCancellationRequested) break;
                status("Disconnected; retry in " + delay / 1000 + "s");
                try { await Task.Delay(delay, cancellation).ConfigureAwait(false); }
                catch (OperationCanceledException) { break; }
                delay = Math.Min(delay * 2, 30000);
            }
            status("Stopped");
        }

        private async Task HandleAsync(ClientWebSocket socket, IDictionary<string, object> message, string requestId, CancellationToken cancellation)
        {
            try
            {
                object response;
                try
                {
                    var tool = Arguments.Text(message, "tool", 100);
                    object rawArgs;
                    message.TryGetValue("args", out rawArgs);
                    var args = rawArgs == null ? new Dictionary<string, object>() : rawArgs as IDictionary<string, object>;
                    if (args == null) throw new ArgumentException("args must be an object.");
                    cancellation.ThrowIfCancellationRequested();
                    status("Running " + tool);
                    var result = await dispatch(tool, args, cancellation).ConfigureAwait(false);
                    response = new { type = "tool_result", requestId = requestId, ok = true, result = result };
                }
                catch (Exception error)
                {
                    response = new { type = "tool_result", requestId = requestId, ok = false, error = error.Message };
                }
                await SendAsync(socket, response, cancellation).ConfigureAwait(false);
                status("Connected");
            }
            catch (Exception error) { status("Result delivery failed: " + error.Message); }
            finally { actionGate.Release(); }
        }

        private async Task SendAsync(ClientWebSocket socket, object message, CancellationToken cancellation)
        {
            var json = new JavaScriptSerializer { MaxJsonLength = 64 * 1024 * 1024 }.Serialize(message);
            var bytes = Encoding.UTF8.GetBytes(json);
            await sendGate.WaitAsync(cancellation).ConfigureAwait(false);
            try { await socket.SendAsync(new ArraySegment<byte>(bytes), WebSocketMessageType.Text, true, cancellation).ConfigureAwait(false); }
            finally { sendGate.Release(); }
        }

        private static async Task<Dictionary<string, object>> ReceiveAsync(ClientWebSocket socket, CancellationToken cancellation)
        {
            var buffer = new byte[8192];
            using (var stream = new MemoryStream())
            {
                WebSocketReceiveResult part;
                do
                {
                    part = await socket.ReceiveAsync(new ArraySegment<byte>(buffer), cancellation).ConfigureAwait(false);
                    if (part.MessageType == WebSocketMessageType.Close) return null;
                    if (part.MessageType != WebSocketMessageType.Text) throw new InvalidDataException("Expected a text relay message.");
                    if (stream.Length + part.Count > 1024 * 1024) throw new InvalidDataException("Relay message exceeds 1 MiB.");
                    stream.Write(buffer, 0, part.Count);
                } while (!part.EndOfMessage);
                var json = new UTF8Encoding(false, true).GetString(stream.ToArray());
                var message = new JavaScriptSerializer { MaxJsonLength = 1024 * 1024, RecursionLimit = 32 }.Deserialize<Dictionary<string, object>>(json);
                if (message == null) throw new InvalidDataException("Expected a relay object.");
                return message;
            }
        }
    }
}