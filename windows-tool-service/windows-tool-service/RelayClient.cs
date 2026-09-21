        private async Task SendAsync(ClientWebSocket socket, object message, CancellationToken cancellation)
        {
            var json = new JavaScriptSerializer { MaxJsonLength = 64 * 1024 * 1024 }.Serialize(message);
            Log.Write("MCP <- Sent: " + json);
            var bytes = Encoding.UTF8.GetBytes(json);
            await sendGate.WaitAsync(cancellation).ConfigureAwait(false);
            try { await socket.SendAsync(new ArraySegment<byte>(bytes), WebSocketMessageType.Text, true, cancellation).ConfigureAwait(false); }
            finally { sendGate.Release(); }
        }
