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

        internal static string ConfigPath
        {
            get { return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "WindowsMcpToolService", "config.json"); }
        }

        internal static AgentConfig Load()
        {
            var config = File.Exists(ConfigPath)
                ? new JavaScriptSerializer().Deserialize<AgentConfig>(File.ReadAllText(ConfigPath))
                : new AgentConfig { CloudUrl = "ws://127.0.0.1:4000", DeviceId = Guid.NewGuid().ToString(), DeviceName = Environment.MachineName };
            if (config == null) throw new InvalidDataException("Invalid agent configuration.");
            config.CloudUrl = Environment.GetEnvironmentVariable("CLOUD_URL") ?? config.CloudUrl;
            config.DeviceId = Environment.GetEnvironmentVariable("DEVICE_ID") ?? config.DeviceId;
            config.DeviceName = Environment.GetEnvironmentVariable("DEVICE_NAME") ?? config.DeviceName;
            config.Validate();
            return config;
        }

        internal void Validate()
        {
            Uri endpoint;
            if (!Uri.TryCreate(CloudUrl, UriKind.Absolute, out endpoint) ||
                (endpoint.Scheme != "ws" && endpoint.Scheme != "wss") ||
                !string.IsNullOrEmpty(endpoint.UserInfo) || !string.IsNullOrEmpty(endpoint.Query) || !string.IsNullOrEmpty(endpoint.Fragment))
                throw new ArgumentException("Cloud URL must be a ws:// or wss:// base URL without credentials, query or fragment.");
            if (endpoint.Scheme == "ws" && !endpoint.IsLoopback)
                throw new ArgumentException("Remote connections require wss://. Plain ws:// is allowed only on loopback.");
            if (string.IsNullOrWhiteSpace(DeviceId) || DeviceId.Length > 200)
                throw new ArgumentException("Device ID is required (maximum 200 characters).");
            if (string.IsNullOrWhiteSpace(DeviceName)) throw new ArgumentException("Device name is required.");
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