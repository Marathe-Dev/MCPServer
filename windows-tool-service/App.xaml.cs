using System;
using System.Diagnostics;
using System.Reflection;
using System.Runtime;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows;

namespace WindowsToolService
{
    public static class ProductInfo
    {
        public static string PrefixForGlobalEvents = "RPC";
        public static string Name = "RemotePC";
        public static string ExePrefix = "RPC";
    }

    public partial class App : Application
    {
        public static string ProductName = string.Empty;
        public static string AppDataFolderPath = string.Empty;

        private Mutex instanceMutex;
        private EventWaitHandle showEvent;
        private RegisteredWaitHandle registration;

        static App()
        {
            // Belt-and-suspenders over the manifest: guarantees CopyFromScreen/SetCursorPos share one physical-pixel space on mixed-DPI monitors.
            try { SetProcessDpiAwarenessContext(PerMonitorAwareV2); }
            catch { /* Win10 < 1703 lacks the API; the manifest's dpiAware still applies. */ }
        }

        protected override void OnStartup(StartupEventArgs args)
        {
            Debugger.Launch();

            base.OnStartup(args);
            if (!Environment.UserInteractive || Process.GetCurrentProcess().SessionId == 0)
            {
                Log.Write("Startup rejected: not an interactive user session.");
                Shutdown(1);
                return;
            }

            try
            {
                LaunchArguments.Instance.Parse(args.Args);

                SetDefaultDllDirectories(0x00000200 | 0x00000800);

                string eventPrefix = ProductInfo.PrefixForGlobalEvents = LaunchArguments.Instance.EventPrefix;
                string exePath = Assembly.GetExecutingAssembly().Location;

                App.ProductName = exePath.Contains($"{ProductInfo.Name} Host") ? $"{ProductInfo.Name} Host" :       // RemotePC Host 
                                  ProductInfo.Name;                                                                 // RemotePC

                App.AppDataFolderPath = Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData) + "\\" + App.ProductName;

                string MutexName = @"Local\" + eventPrefix + "WindowsMcpToolService.Agent";
                string ShowToolEvent = @"Local\" + eventPrefix + "WindowsMcpToolService.Show";

                showEvent = new EventWaitHandle(false, EventResetMode.AutoReset, ShowToolEvent);

                bool createdNew = true;
                instanceMutex = new Mutex(true, MutexName, out createdNew);

                if (createdNew)
                {
                    try
                    {
                        string CommandLine = " ";
                        foreach (string s in args.Args)
                            CommandLine += s;

                        Log.Write("### ---->> Starting The MCP tool Service <<---- ###");
                        Log.Write($"Main CommandLine : {CommandLine}");
                        Log.Write($"Main : ExecutingPath : {exePath}");
                        Log.Write($"Main : ProductName : {App.ProductName}");
                        Log.Write($"Main : EventPrefix : {eventPrefix}");

                        var window = new MainWindow();
                        MainWindow = window;

                        registration = ThreadPool.RegisterWaitForSingleObject(showEvent, delegate
                        {
                            if (!Dispatcher.HasShutdownStarted)
                                Dispatcher.BeginInvoke(new Action(window.ShowForeground));
                        }, null, Timeout.Infinite, false);

                        window.Show();

                        Log.Write("Agent started.");
                    }
                    catch (Exception ex)
                    {
                        Log.Write("App : @E Exception : " + ex.Message);
                        Shutdown(1);
                    }
                }
                else
                {
                    Log.Write("Another agent instance is already running; bringing it forward.");
                    showEvent.Set();
                    Shutdown();
                    return;
                }
            }
            catch (Exception ex)
            {
                Log.Write("App : @E Startup Exception : " + ex.Message, ex);
                Shutdown(1);
            }
        }

        protected override void OnExit(ExitEventArgs args)
        {
            if (registration != null) 
                registration.Unregister(null);

            if (showEvent != null) 
                showEvent.Dispose();

            if (instanceMutex != null)
            {
                try { instanceMutex.ReleaseMutex(); } catch (ApplicationException) { /* not owned; already released */ }
                instanceMutex.Dispose();
            }

            Log.Write("Agent exited.");
            base.OnExit(args);
        }

        [DllImport("kernel32.dll", SetLastError = true)] private static extern bool SetDefaultDllDirectories(uint flags);

        private static readonly IntPtr PerMonitorAwareV2 = new IntPtr(-4);
        [DllImport("user32.dll")] private static extern bool SetProcessDpiAwarenessContext(IntPtr value);
    }
}