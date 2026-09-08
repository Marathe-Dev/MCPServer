using System;
using System.IO;
using System.Text;

namespace WindowsToolService
{
    /// <summary>
    /// Minimal append-only file logger. Never throws — logging must not break the agent.
    /// Writes to MCPToolService.Log next to the executable and trims the file back to the
    /// most recent 512 KB once it grows past 1 MB.
    /// </summary>
    internal static class Log
    {
        private const long MaxBytes = 1024 * 1024;   // rotate once the log passes 1 MB
        private const int KeepBytes = 512 * 1024;    // keep the most recent 512 KB
        private static readonly object Gate = new object();

        /// <summary>The log lives in the running executable's own directory.</summary>
        private static string LogPath
        {
            get { return Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "MCPToolService.Log"); }
        }

        /// <summary>Appends a timestamped line; swallows every error.</summary>
        internal static void Write(string message)
        {
            try
            {
                lock (Gate)
                {
                    Trim();
                    File.AppendAllText(LogPath, DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") + " --> " + message + Environment.NewLine, Encoding.UTF8);
                }
            }
            catch
            {
                // Logging is best-effort — never surface an error to the caller.
            }
        }

        /// <summary>Appends a message together with the exception type and text.</summary>
        internal static void Write(string message, Exception error)
        {
            Write(message + " | " + error.GetType().Name + ": " + error.Message);
        }

        /// <summary>Keeps only the most recent <see cref="KeepBytes"/> once the log passes <see cref="MaxBytes"/>.</summary>
        private static void Trim()
        {
            var info = new FileInfo(LogPath);
            if (!info.Exists || info.Length <= MaxBytes) return;

            byte[] tail;
            using (var stream = new FileStream(LogPath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite))
            {
                stream.Seek(-KeepBytes, SeekOrigin.End);
                tail = new byte[KeepBytes];

                var read = 0;
                while (read < KeepBytes)
                {
                    var chunk = stream.Read(tail, read, KeepBytes - read);
                    if (chunk == 0) break;
                    read += chunk;
                }
            }
            File.WriteAllBytes(LogPath, tail);
        }
    }
}
