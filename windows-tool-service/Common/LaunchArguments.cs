using System;
using System.Runtime;

namespace WindowsToolService
{
    /// <summary>
    /// Parses the single "key=value&amp;key=value" command-line blob RPCMainApp::LaunchWindowsToolService
    /// passes (same convention as RPCChat.exe's command line) — e.g. "eventPrefix=RPC&amp;launchedFrom=RemotePCService".
    /// </summary>
    internal class LaunchArguments
    {
        internal string EventPrefix { get; private set; } = string.Empty;
        internal bool LaunchAsService { get; private set; }

        private static LaunchArguments _instance = new LaunchArguments();
        public static LaunchArguments Instance => _instance;

        internal void Parse(string[] args)
        {
            if (args == null || args.Length == 0) return;

            foreach (var pair in args[0].Split('&'))
            {
                var kv = pair.Split(new[] { '=' }, 2);
                if (kv.Length != 2) continue;

                if (kv[0] == "eventPrefix") EventPrefix = kv[1];
                else if (kv[0] == "LaunchAsService") LaunchAsService = string.Equals(kv[1], "Yes", StringComparison.OrdinalIgnoreCase);
            }
        }
    }
}
