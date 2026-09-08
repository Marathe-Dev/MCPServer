using System;
using System.Collections.Generic;
using System.IO;

namespace WindowsToolService
{
    internal static class FileTools
    {
        internal const long MaxFileBytes = 10L * 1024 * 1024;

        internal static object Read(IDictionary<string, object> args)
        {
            var path = Arguments.Text(args, "path", 32767);
            if (path.IndexOfAny(Path.GetInvalidPathChars()) >= 0)
                throw new ArgumentException("path contains invalid characters.");
            if (!Path.IsPathRooted(path) || !Path.IsPathRooted(Path.GetFullPath(path)))
                throw new ArgumentException("path must be an absolute Windows path.");
            var full = Path.GetFullPath(path);
            if (Directory.Exists(full)) throw new ArgumentException("path refers to a directory, not a file.");
            if (!File.Exists(full)) throw new FileNotFoundException("File not found: " + full);
            var info = new FileInfo(full);
            if (info.Length > MaxFileBytes)
                throw new ArgumentException("File exceeds the 10 MB limit (actual " + info.Length + " bytes).");
            byte[] data;
            using (var stream = new FileStream(full, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete))
            {
                if (stream.Length > MaxFileBytes)
                    throw new ArgumentException("File exceeds the 10 MB limit (actual " + stream.Length + " bytes).");
                data = new byte[stream.Length];
                var read = 0;
                while (read < data.Length)
                {
                    var chunk = stream.Read(data, read, data.Length - read);
                    if (chunk == 0) break;
                    read += chunk;
                }
                if (read != data.Length) Array.Resize(ref data, read);
            }
            return new Dictionary<string, object>
            {
                { "success", true },
                { "backend", "win32" },
                { "timestamp", DateTime.UtcNow.ToString("o") },
                { "path", full },
                { "name", info.Name },
                { "size", data.Length },
                { "base64Data", Convert.ToBase64String(data) }
            };
        }
    }
}
