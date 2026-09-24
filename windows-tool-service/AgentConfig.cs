using System;
using System.Collections.Generic;
using System.IO;
using System.Web.Script.Serialization;

namespace WindowsToolService
{
    internal sealed class AgentConfig
    {
        public string CloudUrl { get; set; }
        public string DeviceId { get; set; }
        public string DeviceName { get; set; }
        public bool EnableCmd { get; set; }
        public bool AutoConnectOnStartup { get; set; }

        /// <summary>"cloud" = direct WebSocket to the Cloud MCP Server (testing); "rpc" = local named pipe to RPCService (production).</summary>
        public string ConnectionMode { get; set; }

        /// <summary>Local named pipe name used to reach RPCService when ConnectionMode is "rpc".</summary>
        public string PipeName { get; set; }

        /// <summary>ConnectionMode, defaulting to "cloud" for configs saved before this field existed.</summary>
        [ScriptIgnore]
        internal string EffectiveConnectionMode
        {
            get { return string.IsNullOrEmpty(ConnectionMode) ? "cloud" : ConnectionMode; }
        }

        // Storage endpoint/region/bucket may live in config.json; access + secret keys come from env only.
        public string E2StorageEndpoint { get; set; }
        public string E2StorageRegion { get; set; }
        public string E2StorageBucket { get; set; }
        public int StorageGetTtlSeconds { get; set; }
        public string E2StorageAccessKey { get; set; }
        public string E2StorageSecretKey { get; set; }

        /// <summary>True when screenshots/files should be uploaded to storage and returned as a presigned URL.</summary>
        [ScriptIgnore]
        internal bool StorageEnabled
        {
            get
            {
                return !string.IsNullOrEmpty(E2StorageEndpoint) && !string.IsNullOrEmpty(E2StorageRegion)
                    && !string.IsNullOrEmpty(E2StorageBucket) && !string.IsNullOrEmpty(E2StorageAccessKey)
                    && !string.IsNullOrEmpty(E2StorageSecretKey);
            }
        }

        internal static string ConfigPath
        {
            get { return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "WindowsMcpToolService", "config.json"); }
        }

        internal static AgentConfig Load()
        {
            var config = File.Exists(ConfigPath)  // C:\Users\Hemanth\AppData\Local\WindowsMcpToolService\config.json
                ? new JavaScriptSerializer().Deserialize<AgentConfig>(File.ReadAllText(ConfigPath))
                : new AgentConfig { CloudUrl = "ws://127.0.0.1:4000", DeviceId = Guid.NewGuid().ToString(), DeviceName = Environment.MachineName };

            if (config == null) 
                throw new InvalidDataException("Invalid agent configuration.");

            if (string.IsNullOrEmpty(config.ConnectionMode)) 
                config.ConnectionMode = "cloud"; // back-compat: configs saved before this field existed

            if (string.IsNullOrEmpty(config.PipeName)) 
                config.PipeName = "RPCService.MCP.Relay";

            // Environment.GetEnvironmentVariable("CLOUD_URL") - To Read from the env variable

            config.CloudUrl = config.CloudUrl; 
            config.DeviceId = config.DeviceId;
            config.DeviceName = config.DeviceName;
            config.E2StorageEndpoint = config.E2StorageEndpoint; // "https://<your-idrive-e2-endpoint>"
            config.E2StorageRegion = config.E2StorageRegion; // "us-east-1"
            config.E2StorageBucket = config.E2StorageBucket; // "your-bucket"
            config.E2StorageAccessKey = config.E2StorageAccessKey;
            config.E2StorageSecretKey = config.E2StorageSecretKey;

            if (config.StorageGetTtlSeconds <= 0) 
                config.StorageGetTtlSeconds = 900;

            config.Validate();
            return config;
        }

        internal void Validate()
        {
            if (EffectiveConnectionMode != "cloud" && EffectiveConnectionMode != "rpc")
                throw new ArgumentException("Connection mode must be \"cloud\" or \"rpc\".");

            if (EffectiveConnectionMode == "cloud")
            {
                Uri endpoint;
                if (!Uri.TryCreate(CloudUrl, UriKind.Absolute, out endpoint) ||
                    (endpoint.Scheme != "ws" && endpoint.Scheme != "wss") ||
                    !string.IsNullOrEmpty(endpoint.UserInfo) || !string.IsNullOrEmpty(endpoint.Query) || !string.IsNullOrEmpty(endpoint.Fragment))
                    throw new ArgumentException("Cloud URL must be a ws:// or wss:// base URL without credentials, query or fragment.");

                if (endpoint.Scheme == "ws" && !endpoint.IsLoopback)
                    throw new ArgumentException("Remote connections require wss://. Plain ws:// is allowed only on loopback.");

                // RPCService/broker own device identity in "rpc" mode, so only the cloud relay requires it.
                if (string.IsNullOrWhiteSpace(DeviceId) || DeviceId.Length > 200)
                    throw new ArgumentException("Device ID is required (maximum 200 characters).");

                if (string.IsNullOrWhiteSpace(DeviceName))
                    throw new ArgumentException("Device name is required.");
            }
            else if (string.IsNullOrWhiteSpace(PipeName) || PipeName.Length > 200 || PipeName.IndexOfAny(new[] { '\\', '/' }) >= 0)
                throw new ArgumentException("Pipe name is required (maximum 200 characters, no path separators).");

            if (!string.IsNullOrEmpty(E2StorageEndpoint))
            {
                Uri storage;
                if (!Uri.TryCreate(E2StorageEndpoint, UriKind.Absolute, out storage) || storage.Scheme != "https")
                    throw new ArgumentException("Storage endpoint must be an absolute https URL.");
            }
        }

        internal void Save()
        {
            Validate();
            Directory.CreateDirectory(Path.GetDirectoryName(ConfigPath));
            File.WriteAllText(ConfigPath, new JavaScriptSerializer().Serialize(this));
        }
    }

    internal static class Arguments
    {
        internal static string Text(IDictionary<string, object> args, string name, int maximum)
        {
            object value;
            if (!args.TryGetValue(name, out value) || !(value is string) || ((string)value).Length > maximum)
                throw new ArgumentException(name + " must be a string of at most " + maximum + " characters.");
            return (string)value;
        }

        internal static int Integer(IDictionary<string, object> args, string name, int minimum, int maximum, int? fallback = null)
        {
            object value;
            if (!args.TryGetValue(name, out value))
            {
                if (fallback.HasValue) return fallback.Value;
                throw new ArgumentException(name + " is required.");
            }
            if (!(value is int) || (int)value < minimum || (int)value > maximum)
                throw new ArgumentException(name + " must be an integer between " + minimum + " and " + maximum + ".");
            return (int)value;
        }

        internal static string Choice(IDictionary<string, object> args, string name, string fallback, params string[] choices)
        {
            var value = args.ContainsKey(name) ? Text(args, name, 40) : fallback;
            if (Array.IndexOf(choices, value) < 0) throw new ArgumentException("Unsupported " + name + ": " + value);
            return value;
        }
    }
}