using System;
using System.ComponentModel;
using System.IO;
using System.Net;
using System.Net.Http;

namespace WindowsToolService
{
    /// <summary>
    /// Translates an exception into text safe to relay back to the AI agent. Always logs the full
    /// technical detail first. Exceptions this codebase throws deliberately (clear, authored English
    /// messages) pass through unchanged; anything else gets a safe generic message instead of leaking
    /// raw .NET/Win32/network internals to the agent/user.
    /// </summary>
    internal static class ErrorMessages
    {
        internal static string Resolve(string tool, Exception error)
        {
            Log.Write("Tool \"" + tool + "\" failed", error);

            // Hand-thrown throughout the codebase with clear, user-facing text already - pass through as-is.
            if (error is ArgumentException || error is InvalidOperationException
                || error is FileNotFoundException || error is OperationCanceledException
                || error is TimeoutException)
                return error.Message;

            var win32 = error as Win32Exception;
            if (win32 != null)
                return "A Windows system call failed while running \"" + tool + "\": " + win32.Message + " (code " + win32.NativeErrorCode + ").";

            if (error is HttpRequestException || error is WebException)
                return "A network error occurred while running \"" + tool + "\". Check the device's internet connection and try again.";

            // Unknown/unexpected exception type: never leak raw .NET internals, the log has the full detail.
            return "An unexpected error occurred while running \"" + tool + "\". Check the agent log (MCPToolService.Log) for details.";
        }
    }
}
