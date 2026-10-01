using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;

namespace WindowsToolService
{
    /// <summary>
    /// Chat tool: shows a view-only "Remote AI Agent" message in RPCChat.exe (host can read, not reply).
    /// First call launches the window with the message on its command line; later calls deliver into the
    /// already-open window via WM_COPYDATA — the same sibling-process IPC mechanism RemotePCUI's
    /// InterProcessSender/Receiver use (D:\CompactUI\#Main\remotepcui\InterProcessCom).
    /// </summary>
    internal sealed partial class DesktopTools
    {
        private const string ChatExePath = @"C:\Program Files (x86)\RemotePC\RemotePCPerformance\RpcApp\Tools\RPCChat.exe";
        private const string ChatSessionId = "MCPChatSession"; // fixed: only one MCP chat window is ever active at a time
        private const int WM_COPYDATA = 0x004A;

        private static Process _chatProcess;

        [StructLayout(LayoutKind.Sequential)]
        private struct COPYDATASTRUCT
        {
            public IntPtr dwData;
            public int cbData;
            public IntPtr lpData;
        }

        [DllImport("user32.dll", CharSet = CharSet.Auto)]
        private static extern IntPtr SendMessage(IntPtr hWnd, int msg, IntPtr wParam, ref COPYDATASTRUCT lParam);

        private static object SendChatMessage(IDictionary<string, object> args)
        {
            var message = Arguments.Text(args, "message", 4000);
            if (string.IsNullOrWhiteSpace(message))
                throw new ArgumentException("message must not be empty.");

            var agentName = args.ContainsKey("agentName") ? $"{Arguments.Text(args, "agentName", 50)} AI Agent" : "Remote AI Agent";

            var hwnd = ActiveChatWindowHandle();
            if (hwnd != IntPtr.Zero)
                SendCopyData(hwnd, message);
            else
                LaunchChatWindow(message, agentName);

            return Result();
        }

        /// <summary>Returns the cached window's handle, or Zero if the chat window needs (re)launching.</summary>
        private static IntPtr ActiveChatWindowHandle()
        {
            if (_chatProcess == null) return IntPtr.Zero;
            try
            {
                _chatProcess.Refresh();
                return _chatProcess.HasExited ? IntPtr.Zero : _chatProcess.MainWindowHandle;
            }
            catch (InvalidOperationException) { return IntPtr.Zero; } // process exited between calls
        }

        private static void LaunchChatWindow(string message, string agentName)
        {
            var arguments = "action=mcp_chat&machine_id=" + ChatSessionId +
                "&remote_machine_name=" + Uri.EscapeDataString(agentName) +
                "&eventPrefix=" + "RPC" +
                "&message=" + Base64UrlEncode(message);

            _chatProcess = Process.Start(new ProcessStartInfo(ChatExePath, arguments) { UseShellExecute = false });
        }

        private static void SendCopyData(IntPtr hwnd, string message)
        {
            var ptr = Marshal.StringToHGlobalUni(message);
            try
            {
                var cds = new COPYDATASTRUCT { dwData = IntPtr.Zero, cbData = (message.Length + 1) * 2, lpData = ptr };
                SendMessage(hwnd, WM_COPYDATA, IntPtr.Zero, ref cds);
            }
            finally { Marshal.FreeHGlobal(ptr); }
        }

        // Base64Url (no '+','/','=') so the message/username survive the '&'/'='-delimited mcp_chat command line untouched.
        private static string Base64UrlEncode(string value)
        {
            return Convert.ToBase64String(Encoding.UTF8.GetBytes(value)).Replace('+', '-').Replace('/', '_').TrimEnd('=');
        }
    }
}
