using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Reflection;
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
        private const string ChatSessionId = "MCPChatSession"; // fixed: only one MCP chat window is ever active at a time
        private const string ChatViewerName = "Remote AI Agent";
        private const int WM_COPYDATA = 0x004A;

        private const string RPC_INI_SEC_GEN = "General Settings";
        private const string RPC_MCP_CHAT_MESSAGE = "MCP_Chat_Message";

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

            var agentName = args.ContainsKey("agentName") ? $"{Arguments.Text(args, "agentName", 50)} AI Agent" : ChatViewerName;

            var hwnd = ActiveChatWindowHandle();
            if (hwnd != IntPtr.Zero)
                SendCopyData(hwnd, message, agentName);
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
            try
            {
                ConfigurationIniFile.GetInstance.Write(RPC_MCP_CHAT_MESSAGE, Base64UrlEncode(message), RPC_INI_SEC_GEN);

                string ChatExePath = Path.Combine(Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location), @"RemotePCPerformance\RpcApp\Tools\RPCChat.exe");

                var arguments = "action=mcp_chat&machine_id=" + ChatSessionId +
                    "&remote_machine_name=" + Uri.EscapeDataString(ChatViewerName) +
                    "&mcp_agentName=" + Uri.EscapeDataString(agentName) +
                    "&eventPrefix=" + ProductInfo.PrefixForGlobalEvents;

                _chatProcess = Process.Start(new ProcessStartInfo(ChatExePath, arguments) { UseShellExecute = false });
            }
            catch (Exception ex)
            {
                Log.Write($"DesktopTools.Chats - LaunchChatWindow : {ex}");
            }
        }

        private static void SendCopyData(IntPtr hwnd, string message, string agentName)
        {
            var payload = agentName + "|" + message;
            var ptr = Marshal.StringToHGlobalUni(payload);
            try
            {
                var cds = new COPYDATASTRUCT { dwData = IntPtr.Zero, cbData = (payload.Length + 1) * 2, lpData = ptr };
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
