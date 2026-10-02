using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Text;

namespace WindowsToolService
{
    /// <summary>Restart tool: schedules (or cancels) a Windows restart and acknowledges before the reboot happens.</summary>
    internal sealed partial class DesktopTools
    {
        private const int MinDelaySeconds = 5;
        private const int MaxDelaySeconds = 3600;
        private const int DefaultDelaySeconds = 30;

        /// <summary>Schedules a restart (or cancels a pending one) via shutdown.exe and returns once it's scheduled — well before the reboot.</summary>
        private object Restart(IDictionary<string, object> args)
        {
            var action = Arguments.Choice(args, "action", "restart", "restart", "cancel");
            int delaySeconds;
            var arguments = BuildArguments(args, out delaySeconds);

            var exe = Path.Combine(Environment.SystemDirectory, "shutdown.exe");
            using (var process = Process.Start(new ProcessStartInfo(exe, arguments) { UseShellExecute = false, CreateNoWindow = true }))
            {
                process.WaitForExit(10000);
                if (process.ExitCode != 0)
                    throw new InvalidOperationException("shutdown.exe exited with code " + process.ExitCode + " (action=" + action +
                        "). A restart may already be scheduled, or the action lacks permission.");
            }

            var result = Result();
            result["action"] = action;
            if (action == "restart")
            {
                result["delaySeconds"] = delaySeconds;
                result["scheduledAt"] = DateTime.UtcNow.AddSeconds(delaySeconds).ToString("o");
            }
            return result;
        }

        /// <summary>Builds the shutdown.exe argument string; kept pure (no process spawn) so it's testable without ever rebooting a machine.</summary>
        internal static string BuildArguments(IDictionary<string, object> args, out int delaySeconds)
        {
            var action = Arguments.Choice(args, "action", "restart", "restart", "cancel");
            if (action == "cancel")
            {
                delaySeconds = 0;
                return "/a";
            }

            delaySeconds = Arguments.Integer(args, "delaySeconds", MinDelaySeconds, MaxDelaySeconds, DefaultDelaySeconds);
            var force = ArgFlag(args, "force");
            var message = args.ContainsKey("message") ? Arguments.Text(args, "message", 512) : null;

            var builder = new StringBuilder("/r /t " + delaySeconds);
            if (force) builder.Append(" /f");
            if (!string.IsNullOrEmpty(message)) builder.Append(" /c \"" + message.Replace("\"", "'") + "\"");
            return builder.ToString();
        }
    }
}
