using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Diagnostics;
using System.IO;
using System.IO.Pipes;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace WindowsToolService
{
    internal sealed class WinPtyCommand
    {
        internal async Task<object> ExecuteAsync(IDictionary<string, object> args, CancellationToken cancellation)
        {
            DesktopTools.RequireInteractiveDesktop();
            var command = Arguments.Text(args, "command", 8000);
            if (string.IsNullOrWhiteSpace(command) || command.IndexOfAny(new[] { '\0', '\r', '\n' }) >= 0)
                throw new ArgumentException("command must be a non-empty single CMD command line; use & or && to compose commands.");
            var directory = args.ContainsKey("workingDirectory") ? Arguments.Text(args, "workingDirectory", 32767)
                : Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
            if (!Path.IsPathRooted(directory) || !Directory.Exists(directory)) throw new ArgumentException("workingDirectory must be an existing absolute directory.");
            var timeoutMs = Arguments.Integer(args, "timeoutMs", 100, 20000, 10000);
            var maxOutputChars = Arguments.Integer(args, "maxOutputChars", 1024, 1048576, 65536);
            if (!File.Exists(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "winpty.dll")) ||
                !File.Exists(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "winpty-agent.exe")))
                throw new FileNotFoundException("Install matching x64 winpty.dll and winpty-agent.exe beside WindowsToolService.exe. See README.");

            IntPtr config = IntPtr.Zero, terminal = IntPtr.Zero, spawnConfig = IntPtr.Zero;
            IntPtr process = IntPtr.Zero, thread = IntPtr.Zero, error;
            NamedPipeClientStream input = null, output = null;
            Task reader = null;
            var capture = new CaptureBuffer(maxOutputChars);
            var stopwatch = Stopwatch.StartNew();
            try
            {
                cancellation.ThrowIfCancellationRequested();
                config = Native.winpty_config_new(0, out error);
                Check(error);
                if (config == IntPtr.Zero) throw new InvalidOperationException("WinPTY configuration failed.");
                Native.winpty_config_set_initial_size(config, 200, 40);
                Native.winpty_config_set_agent_timeout(config, 5000);
                terminal = Native.winpty_open(config, out error);
                Check(error);
                if (terminal == IntPtr.Zero) throw new InvalidOperationException("WinPTY startup failed.");
                input = Connect(Native.winpty_conin_name(terminal), PipeDirection.Out);
                output = Connect(Native.winpty_conout_name(terminal), PipeDirection.In);
                var executable = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System), "cmd.exe");
                var commandLine = "\"" + executable + "\" /d /s /c \"" + command + "\"";
                spawnConfig = Native.winpty_spawn_config_new(1, executable, commandLine, directory, IntPtr.Zero, out error);
                Check(error);
                if (spawnConfig == IntPtr.Zero) throw new InvalidOperationException("WinPTY spawn configuration failed.");
                uint processError;
                var spawned = Native.winpty_spawn(terminal, spawnConfig, out process, out thread, out processError, out error);
                Check(error);
                if (!spawned) throw new Win32Exception((int)processError);
                Native.CloseHandle(thread);
                thread = IntPtr.Zero;
                reader = ReadAsync(output, capture);
                var timedOut = false;
                while (true)
                {
                    cancellation.ThrowIfCancellationRequested();
                    var wait = Native.WaitForSingleObject(process, 0);
                    if (wait == 0) break;
                    if (wait != 258) throw new Win32Exception();
                    if (stopwatch.ElapsedMilliseconds >= timeoutMs) { timedOut = true; break; }
                    await Task.Delay(25, cancellation).ConfigureAwait(false);
                }
                uint exitCode;
                if (!Native.GetExitCodeProcess(process, out exitCode)) throw new Win32Exception();
                if (timedOut)
                {
                    Native.winpty_free(terminal);
                    terminal = IntPtr.Zero;
                }
                var drained = await Task.WhenAny(reader, Task.Delay(2000, cancellation)).ConfigureAwait(false) == reader;
                cancellation.ThrowIfCancellationRequested();
                if (drained) await reader.ConfigureAwait(false);
                return new
                {
                    success = !timedOut && exitCode == 0,
                    backend = "winpty",
                    timestamp = DateTime.UtcNow.ToString("o"),
                    exitCode = timedOut ? (long?)null : exitCode,
                    timedOut = timedOut,
                    output = capture.Text,
                    truncated = capture.Truncated || !drained,
                    durationMs = stopwatch.ElapsedMilliseconds
                };
            }
            finally
            {
                if (terminal != IntPtr.Zero) Native.winpty_free(terminal);
                if (input != null) input.Dispose();
                if (output != null) output.Dispose();
                if (reader != null)
                {
                    try { await reader.ConfigureAwait(false); }
                    catch (IOException) { }
                    catch (ObjectDisposedException) { }
                }
                if (thread != IntPtr.Zero) Native.CloseHandle(thread);
                if (process != IntPtr.Zero) Native.CloseHandle(process);
                if (spawnConfig != IntPtr.Zero) Native.winpty_spawn_config_free(spawnConfig);
                if (config != IntPtr.Zero) Native.winpty_config_free(config);
            }
        }

        private static NamedPipeClientStream Connect(IntPtr name, PipeDirection direction)
        {
            var path = Marshal.PtrToStringUni(name);
            const string prefix = @"\\.\pipe\";
            if (path == null || !path.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)) throw new IOException("WinPTY returned an invalid local pipe name.");
            var pipe = new NamedPipeClientStream(".", path.Substring(prefix.Length), direction, PipeOptions.Asynchronous);
            try { pipe.Connect(5000); return pipe; }
            catch { pipe.Dispose(); throw; }
        }

        private static async Task ReadAsync(Stream output, CaptureBuffer capture)
        {
            var bytes = new byte[8192];
            var characters = new char[8192];
            var decoder = Encoding.UTF8.GetDecoder();
            int count;
            while ((count = await output.ReadAsync(bytes, 0, bytes.Length).ConfigureAwait(false)) > 0)
                capture.Append(characters, decoder.GetChars(bytes, 0, count, characters, 0, false));
            capture.Append(characters, decoder.GetChars(bytes, 0, 0, characters, 0, true));
        }

        private static void Check(IntPtr error)
        {
            if (error == IntPtr.Zero) return;
            try { throw new InvalidOperationException("WinPTY: " + Marshal.PtrToStringUni(Native.winpty_error_msg(error))); }
            finally { Native.winpty_error_free(error); }
        }

        private sealed class CaptureBuffer
        {
            private readonly int maximum;
            private readonly StringBuilder text = new StringBuilder();
            private bool truncated;
            internal CaptureBuffer(int maximum) { this.maximum = maximum; }
            internal string Text { get { lock (text) return text.ToString(); } }
            internal bool Truncated { get { lock (text) return truncated; } }
            internal void Append(char[] value, int count)
            {
                lock (text)
                {
                    var available = Math.Min(count, maximum - text.Length);
                    text.Append(value, 0, available);
                    if (available < count) truncated = true;
                }
            }
        }

        private static class Native
        {
            [DllImport("winpty.dll", CallingConvention = CallingConvention.Cdecl)] internal static extern IntPtr winpty_config_new(ulong flags, out IntPtr error);
            [DllImport("winpty.dll", CallingConvention = CallingConvention.Cdecl)] internal static extern void winpty_config_set_initial_size(IntPtr config, int columns, int rows);
            [DllImport("winpty.dll", CallingConvention = CallingConvention.Cdecl)] internal static extern void winpty_config_set_agent_timeout(IntPtr config, uint timeoutMs);
            [DllImport("winpty.dll", CallingConvention = CallingConvention.Cdecl)] internal static extern void winpty_config_free(IntPtr config);
            [DllImport("winpty.dll", CallingConvention = CallingConvention.Cdecl)] internal static extern IntPtr winpty_open(IntPtr config, out IntPtr error);
            [DllImport("winpty.dll", CallingConvention = CallingConvention.Cdecl)] internal static extern IntPtr winpty_conin_name(IntPtr terminal);
            [DllImport("winpty.dll", CallingConvention = CallingConvention.Cdecl)] internal static extern IntPtr winpty_conout_name(IntPtr terminal);
            [DllImport("winpty.dll", CallingConvention = CallingConvention.Cdecl, CharSet = CharSet.Unicode)] internal static extern IntPtr winpty_spawn_config_new(ulong flags, string application, string commandLine, string directory, IntPtr environment, out IntPtr error);
            [DllImport("winpty.dll", CallingConvention = CallingConvention.Cdecl)] internal static extern void winpty_spawn_config_free(IntPtr config);
            [DllImport("winpty.dll", CallingConvention = CallingConvention.Cdecl)] internal static extern bool winpty_spawn(IntPtr terminal, IntPtr config, out IntPtr process, out IntPtr thread, out uint processError, out IntPtr error);
            [DllImport("winpty.dll", CallingConvention = CallingConvention.Cdecl)] internal static extern void winpty_free(IntPtr terminal);
            [DllImport("winpty.dll", CallingConvention = CallingConvention.Cdecl)] internal static extern IntPtr winpty_error_msg(IntPtr error);
            [DllImport("winpty.dll", CallingConvention = CallingConvention.Cdecl)] internal static extern void winpty_error_free(IntPtr error);
            [DllImport("kernel32.dll", SetLastError = true)] internal static extern uint WaitForSingleObject(IntPtr handle, uint milliseconds);
            [DllImport("kernel32.dll", SetLastError = true)] internal static extern bool GetExitCodeProcess(IntPtr process, out uint exitCode);
            [DllImport("kernel32.dll")] internal static extern bool CloseHandle(IntPtr handle);
        }
    }
}