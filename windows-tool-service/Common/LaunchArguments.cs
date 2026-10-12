using System;
using System.Runtime;

namespace WindowsToolService
{
    /// <summary>
    /// Parses the single "key=value&amp;key=value" command-line blob RPCMainApp::LaunchWindowsToolService
    /// passes (same convention as RPCChat.exe's command line) — e.g. "productType=RemotePC" or
    /// "productType=RemotePC%20Host". Mirrors RemotePC-MCP-Host's host::launch_args.
    /// </summary>
    internal class LaunchArguments
    {
        private const string DefaultProduct = "RemotePC";
        private const string HostProduct = "RemotePC Host";

        internal string ProductType { get; private set; } = DefaultProduct;

        private static LaunchArguments _instance = new LaunchArguments();
        public static LaunchArguments Instance => _instance;

        internal void Parse(string[] args)
        {
            if (args == null || args.Length == 0) return;

            foreach (var pair in args[0].Split('&'))
            {
                var kv = pair.Split(new[] { '=' }, 2);
                if (kv.Length != 2) continue;
                
                if (kv[0] == "productType") ProductType = ResolveProduct(Uri.UnescapeDataString(kv[1]));
            }
        }

        /// <summary>Matches a known product name case-insensitively, falling back to RemotePC for anything unrecognised.</summary>
        private static string ResolveProduct(string name)
        {
            var trimmed = name.Trim();
            if (string.Equals(trimmed, HostProduct, StringComparison.OrdinalIgnoreCase)) return HostProduct;
            return DefaultProduct;
        }
    }
}
