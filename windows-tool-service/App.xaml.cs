using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows;

namespace WindowsToolService
{
    public partial class App : Application
    {
        private Mutex instanceMutex;
        private bool ownsMutex;
        private EventWaitHandle showEvent;
        private RegisteredWaitHandle registration;

        protected override void OnStartup(StartupEventArgs args)
        {
            base.OnStartup(args);
            if (!Environment.UserInteractive || Process.GetCurrentProcess().SessionId == 0)
            {
                Shutdown(1);
                return;
            }

            try
            {
                if (args.Args.Length != 0)
                    throw new ArgumentException("Launch this desktop agent without command-line arguments.");

                SetDefaultDllDirectories(0x00000200 | 0x00000800);
                instanceMutex = new Mutex(false, @"Local\WindowsMcpToolService.Agent");

                try 
                { 
                    ownsMutex = instanceMutex.WaitOne(0); 
                }
                catch (AbandonedMutexException) 
                { 
                    ownsMutex = true; 
                }

                showEvent = new EventWaitHandle(false, EventResetMode.AutoReset, @"Local\WindowsMcpToolService.Show");

                if (!ownsMutex)
                {
                    showEvent.Set();
                    Shutdown();
                    return;
                }

                var window = new MainWindow();
                MainWindow = window;

                registration = ThreadPool.RegisterWaitForSingleObject(showEvent, delegate
                {
                    if (!Dispatcher.HasShutdownStarted)
                        Dispatcher.BeginInvoke(new Action(window.ShowForeground));
                }, null, Timeout.Infinite, false);

                window.Show();
            }
            catch (Exception error)
            {
                MessageBox.Show(error.Message, "Windows MCP Tool Service", MessageBoxButton.OK, MessageBoxImage.Error);
                Shutdown(1);
            }
        }

        protected override void OnExit(ExitEventArgs args)
        {
            if (registration != null) 
                registration.Unregister(null);

            if (showEvent != null) 
                showEvent.Dispose();

            if (ownsMutex) 
                instanceMutex.ReleaseMutex();

            if (instanceMutex != null) 
                instanceMutex.Dispose();

            base.OnExit(args);
        }

        [DllImport("kernel32.dll", SetLastError = true)] private static extern bool SetDefaultDllDirectories(uint flags);
    }
}