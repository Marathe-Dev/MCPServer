using System;
using System.Collections.Generic;
using System.Globalization;
using System.Net;
using System.Net.Http;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace WindowsToolService
{
    /// <summary>
    /// Minimal AWS SigV4 query presigner for S3-compatible storage (IDrive e2), path-style.
    /// Uploads bytes to the bucket and returns a presigned GET URL that the AI agent can
    /// download with no credentials until it expires. Signs only the host header
    /// (UNSIGNED-PAYLOAD), so the uploader may set any Content-Type.
    /// </summary>
    internal sealed class S3Presigner
    {
        private const string Algorithm = "AWS4-HMAC-SHA256";
        private const string Service = "s3";
        private const string UnsignedPayload = "UNSIGNED-PAYLOAD";

        private static readonly HttpClient Http = CreateClient();

        private readonly string _scheme;
        private readonly string _host;      // host[:port]
        private readonly string _basePath;  // "/{bucket}"
        private readonly string _region;
        private readonly string _accessKey;
        private readonly string _secretKey;

        internal S3Presigner(AgentConfig config)
        {
            var endpoint = new Uri(config.E2StorageEndpoint);
            _scheme = endpoint.Scheme;
            _host = endpoint.Authority;
            _basePath = "/" + config.E2StorageBucket.Trim('/');
            _region = config.E2StorageRegion;
            _accessKey = config.E2StorageAccessKey;
            _secretKey = config.E2StorageSecretKey;
        }

        private static HttpClient CreateClient()
        {
            ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12;
            return new HttpClient { Timeout = TimeSpan.FromSeconds(60) };
        }

        /// <summary>Uploads the bytes to <paramref name="key"/> and returns a presigned GET URL.</summary>
        internal async Task<string> UploadAsync(string key, byte[] data, string contentType, int getTtlSeconds, CancellationToken token)
        {
            var putUrl = Presign("PUT", key, 300);
            using (var content = new ByteArrayContent(data))
            using (var request = new HttpRequestMessage(HttpMethod.Put, putUrl) { Content = content })
            {
                content.Headers.TryAddWithoutValidation("Content-Type", contentType);
                using (var response = await Http.SendAsync(request, token).ConfigureAwait(false))
                {
                    if (!response.IsSuccessStatusCode)
                    {
                        var body = await response.Content.ReadAsStringAsync().ConfigureAwait(false);
                        if (body != null && body.Length > 300) body = body.Substring(0, 300);
                        throw new InvalidOperationException("Storage upload failed (" + (int)response.StatusCode + "): " + body);
                    }
                }
            }
            return Presign("GET", key, getTtlSeconds);
        }

        /// <summary>Builds a SigV4 query-presigned URL for one method + object key.</summary>
        internal string Presign(string method, string key, int expiresSeconds)
        {
            var now = DateTime.UtcNow;
            var amzDate = now.ToString("yyyyMMddTHHmmssZ", CultureInfo.InvariantCulture);
            var dateStamp = now.ToString("yyyyMMdd", CultureInfo.InvariantCulture);
            var credentialScope = dateStamp + "/" + _region + "/" + Service + "/aws4_request";
            var canonicalUri = _basePath + "/" + EncodeKey(key);

            var query = new SortedDictionary<string, string>(StringComparer.Ordinal)
            {
                { "X-Amz-Algorithm", Algorithm },
                { "X-Amz-Credential", _accessKey + "/" + credentialScope },
                { "X-Amz-Date", amzDate },
                { "X-Amz-Expires", expiresSeconds.ToString(CultureInfo.InvariantCulture) },
                { "X-Amz-SignedHeaders", "host" },
            };
            var canonicalQuery = CanonicalQuery(query);
            var canonicalRequest = method + "\n" + canonicalUri + "\n" + canonicalQuery + "\n" +
                "host:" + _host + "\n\nhost\n" + UnsignedPayload;

            var stringToSign = Algorithm + "\n" + amzDate + "\n" + credentialScope + "\n" + Hex(Sha256(canonicalRequest));
            var signature = Hex(HmacSha256(DeriveSigningKey(_secretKey, dateStamp, _region, Service), stringToSign));

            return _scheme + "://" + _host + canonicalUri + "?" + canonicalQuery + "&X-Amz-Signature=" + signature;
        }

        /// <summary>SigV4 signing key derivation (exposed for a known-answer test).</summary>
        internal static byte[] DeriveSigningKey(string secret, string dateStamp, string region, string service)
        {
            var kDate = HmacSha256(Encoding.UTF8.GetBytes("AWS4" + secret), dateStamp);
            var kRegion = HmacSha256(kDate, region);
            var kService = HmacSha256(kRegion, service);
            return HmacSha256(kService, "aws4_request");
        }

        private static string CanonicalQuery(SortedDictionary<string, string> query)
        {
            var sb = new StringBuilder();
            foreach (var pair in query)
            {
                if (sb.Length > 0) sb.Append('&');
                sb.Append(Encode(pair.Key)).Append('=').Append(Encode(pair.Value));
            }
            return sb.ToString();
        }

        /// <summary>Encodes an object key, preserving '/' between path segments.</summary>
        private static string EncodeKey(string key)
        {
            var parts = key.Split('/');
            for (var i = 0; i < parts.Length; i++) parts[i] = Encode(parts[i]);
            return string.Join("/", parts);
        }

        /// <summary>RFC 3986 encoding as required by AWS: unreserved chars raw, everything else %XX (upper-hex).</summary>
        private static string Encode(string value)
        {
            var bytes = Encoding.UTF8.GetBytes(value);
            var sb = new StringBuilder(bytes.Length * 3);
            foreach (var b in bytes)
            {
                var c = (char)b;
                if ((c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') ||
                    c == '-' || c == '_' || c == '.' || c == '~')
                    sb.Append(c);
                else
                    sb.Append('%').Append(b.ToString("X2", CultureInfo.InvariantCulture));
            }
            return sb.ToString();
        }

        private static byte[] Sha256(string text)
        {
            using (var sha = SHA256.Create()) return sha.ComputeHash(Encoding.UTF8.GetBytes(text));
        }

        private static byte[] HmacSha256(byte[] key, string data)
        {
            using (var hmac = new HMACSHA256(key)) return hmac.ComputeHash(Encoding.UTF8.GetBytes(data));
        }

        private static string Hex(byte[] bytes)
        {
            var sb = new StringBuilder(bytes.Length * 2);
            foreach (var b in bytes) sb.Append(b.ToString("x2", CultureInfo.InvariantCulture));
            return sb.ToString();
        }
    }
}
