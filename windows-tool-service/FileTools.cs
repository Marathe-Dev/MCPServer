using System;
using System.Collections.Generic;
using System.IO;
using System.Threading;
using System.Threading.Tasks;

namespace WindowsToolService
{
    internal static class FileTools
    {
        internal const long MaxFileBytes = 10L * 1024 * 1024;

        /// <summary>Reads a file and returns it inline as base64.</summary>
        internal static object Read(IDictionary<string, object> args)
        {
            string full, name;
            var data = ReadBytes(args, out full, out name);
            var result = Envelope(full, name, data.Length);
            result["base64Data"] = Convert.ToBase64String(data);
            return result;
        }

        /// <summary>Reads a file, uploads it to storage, and returns a presigned download URL.</summary>
        internal static async Task<object> UploadAsync(IDictionary<string, object> args, AgentConfig config, CancellationToken token)
        {
            string full, name;
            var data = ReadBytes(args, out full, out name);
            var contentType = ContentType(name);
            var key = "files/" + config.DeviceId + "/" + Guid.NewGuid().ToString("N") + "/" + SafeName(name);
            var url = await new S3Presigner(config).UploadAsync(key, data, contentType, config.StorageGetTtlSeconds, token).ConfigureAwait(false);

            var result = Envelope(full, name, data.Length);
            result["contentType"] = contentType;
            result["uploaded"] = true;
            result["url"] = url;
            return result;
        }

        private static Dictionary<string, object> Envelope(string full, string name, int size)
        {
            return new Dictionary<string, object>
            {
                { "success", true },
                { "backend", "win32" },
                { "timestamp", DateTime.UtcNow.ToString("o") },
                { "path", full },
                { "name", name },
                { "size", size }
            };
        }

        private static byte[] ReadBytes(IDictionary<string, object> args, out string full, out string name)
        {
            var path = Arguments.Text(args, "path", 32767);
            if (path.IndexOfAny(Path.GetInvalidPathChars()) >= 0)
                throw new ArgumentException("path contains invalid characters.");
            if (!Path.IsPathRooted(path) || !Path.IsPathRooted(Path.GetFullPath(path)))
                throw new ArgumentException("path must be an absolute Windows path.");
            full = Path.GetFullPath(path);
            if (Directory.Exists(full)) throw new ArgumentException("path refers to a directory, not a file.");
            if (!File.Exists(full)) throw new FileNotFoundException("File not found: " + full);
            var info = new FileInfo(full);
            if (info.Length > MaxFileBytes)
                throw new ArgumentException("File exceeds the 10 MB limit (actual " + info.Length + " bytes).");
            name = info.Name;

            using (var stream = new FileStream(full, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete))
            {
                if (stream.Length > MaxFileBytes)
                    throw new ArgumentException("File exceeds the 10 MB limit (actual " + stream.Length + " bytes).");
                var data = new byte[stream.Length];
                var read = 0;
                while (read < data.Length)
                {
                    var chunk = stream.Read(data, read, data.Length - read);
                    if (chunk == 0) break;
                    read += chunk;
                }
                if (read != data.Length) Array.Resize(ref data, read);
                return data;
            }
        }

        /// <summary>Keeps the file name usable inside a storage object key.</summary>
        private static string SafeName(string name)
        {
            var chars = name.ToCharArray();
            for (var i = 0; i < chars.Length; i++)
                if (chars[i] < 32 || "/\\?%*:|\"<>".IndexOf(chars[i]) >= 0) chars[i] = '_';
            var safe = new string(chars).Trim();
            return safe.Length == 0 ? "file" : safe;
        }

        private static string ContentType(string name)
        {
            var ext = Path.GetExtension(name).ToLowerInvariant();
            switch (ext)
            {
                case ".txt": case ".log": case ".csv": return "text/plain";
                case ".json": return "application/json";
                case ".xml": return "application/xml";
                case ".html": case ".htm": return "text/html";
                case ".pdf": return "application/pdf";
                case ".png": return "image/png";
                case ".jpg": case ".jpeg": return "image/jpeg";
                case ".gif": return "image/gif";
                case ".zip": return "application/zip";
                default: return "application/octet-stream";
            }
        }
    }
}
