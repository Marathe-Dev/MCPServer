using System;
using System.IO;
using System.IO.Pipes;
using System.Net;
using System.Net.WebSockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace WindowsToolService
{
    /// <summary>
    /// One raw JSON-line duplex connection. WebSocket (direct cloud testing) and named pipe
    /// (local RPCService, production) both implement this so RelayClient's message loop and
    /// tool dispatch stay identical regardless of which one is active.
    /// </summary>
    internal interface IRelayChannel : IDisposable
    {
        Task ConnectAsync(CancellationToken cancellation);
        Task SendAsync(string json, CancellationToken cancellation);

        /// <summary>Returns null when the peer closed the connection.</summary>
        Task<string> ReceiveAsync(CancellationToken cancellation);
    }

    /// <summary>Direct WebSocket to the Cloud MCP Server — used to test tools without RPCService.</summary>
    internal sealed class WebSocketRelayChannel : IRelayChannel
    {
        private readonly Uri _uri;
        private ClientWebSocket _socket;

        internal WebSocketRelayChannel(string cloudUrl)
        {
            ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12;
            _uri = new Uri(cloudUrl.TrimEnd('/') + "/device-link");
        }

        public async Task ConnectAsync(CancellationToken cancellation)
        {
            _socket = new ClientWebSocket();
            using (var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellation))
            {
                timeout.CancelAfter(15000);
                await _socket.ConnectAsync(_uri, timeout.Token).ConfigureAwait(false);
            }
        }

        public Task SendAsync(string json, CancellationToken cancellation)
        {
            var bytes = Encoding.UTF8.GetBytes(json);
            return _socket.SendAsync(new ArraySegment<byte>(bytes), WebSocketMessageType.Text, true, cancellation);
        }

        public async Task<string> ReceiveAsync(CancellationToken cancellation)
        {
            var buffer = new byte[8192];
            using (var stream = new MemoryStream())
            {
                WebSocketReceiveResult part;
                do
                {
                    part = await _socket.ReceiveAsync(new ArraySegment<byte>(buffer), cancellation).ConfigureAwait(false);
                    if (part.MessageType == WebSocketMessageType.Close) return null;
                    if (part.MessageType != WebSocketMessageType.Text) throw new InvalidDataException("Expected a text relay message.");
                    if (stream.Length + part.Count > 1024 * 1024) throw new InvalidDataException("Relay message exceeds 1 MiB.");
                    stream.Write(buffer, 0, part.Count);
                } while (!part.EndOfMessage);
                return new UTF8Encoding(false, true).GetString(stream.ToArray());
            }
        }

        public void Dispose()
        {
            if (_socket == null) return;
            try { _socket.Abort(); } catch { }
            _socket.Dispose();
        }
    }

    /// <summary>
    /// Local IPC transport to RPCService: a duplex named pipe (\\.\pipe\{name}) carrying
    /// newline-delimited JSON, one object per line. JSON serializers escape embedded control
    /// characters (including newlines) in string values, so this framing never splits a message.
    /// RPCService owns the pipe server; this side connects as a client and reconnects with the
    /// same backoff as the cloud transport.
    /// </summary>
    internal sealed class PipeRelayChannel : IRelayChannel
    {
        private readonly string _pipeName;
        private NamedPipeClientStream _pipe;
        private StreamReader _reader;
        private StreamWriter _writer;

        internal PipeRelayChannel(string pipeName)
        {
            _pipeName = pipeName;
        }

        public Task ConnectAsync(CancellationToken cancellation)
        {
            var pipe = new NamedPipeClientStream(".", _pipeName, PipeDirection.InOut, PipeOptions.Asynchronous);
            _pipe = pipe;
            return Task.Run(() =>
            {
                // NamedPipeClientStream.Connect has no CancellationToken overload on .NET 4.5;
                // disposing the pipe from the cancellation callback unblocks the wait instead.
                using (cancellation.Register(() => { try { pipe.Dispose(); } catch { } }))
                {
                    try { pipe.Connect(15000); }
                    catch (Exception) { cancellation.ThrowIfCancellationRequested(); throw; }
                }
                _reader = new StreamReader(pipe, new UTF8Encoding(false), false, 8192, true);
                _writer = new StreamWriter(pipe, new UTF8Encoding(false), 8192, true) { AutoFlush = true, NewLine = "\n" };
            });
        }

        public Task SendAsync(string json, CancellationToken cancellation)
        {
            return _writer.WriteLineAsync(json);
        }

        public async Task<string> ReceiveAsync(CancellationToken cancellation)
        {
            // NamedPipeClientStream has no cancellable read; closing the pipe unblocks ReadLineAsync.
            using (cancellation.Register(() => { try { _pipe.Close(); } catch { } }))
            {
                try { return await _reader.ReadLineAsync().ConfigureAwait(false); }
                catch (ObjectDisposedException) { return null; }
                catch (IOException) { return null; }
            }
        }

        public void Dispose()
        {
            if (_writer != null) try { _writer.Dispose(); } catch { }
            if (_reader != null) try { _reader.Dispose(); } catch { }
            if (_pipe != null) try { _pipe.Dispose(); } catch { }
        }
    }
}
