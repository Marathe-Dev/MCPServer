using System;
using System.ComponentModel;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;

namespace WindowsToolService
{
    public partial class MainWindow : Window
    {
        private AgentConfig config;
        private CancellationTokenSource cancellation;
        private Task running;
        private Task stoppingTask;
        private bool initialized;
        private bool closing;
        private bool allowClose;

        public MainWindow() : this(null) { }

        internal MainWindow(AgentConfig config)
        {
            InitializeComponent();
            this.config = config;
        }

        private async void OnLoaded(object sender, RoutedEventArgs args)
        {
            if (initialized || DesignerProperties.GetIsInDesignMode(this)) return;
            try
            {
                config = config ?? AgentConfig.Load();
                cloud.Text = config.CloudUrl;
                deviceId.Password = config.DeviceId;
                name.Text = config.DeviceName;
                enableCmd.IsChecked = config.EnableCmd;
                autoConnect.IsChecked = config.AutoConnectOnStartup;
                initialized = true;
                ShowForeground();
                if (config.AutoConnectOnStartup) await ConnectAsync();
            }
            catch (Exception error)
            {
                MessageBox.Show(this, error.Message, "Cannot load settings", MessageBoxButton.OK, MessageBoxImage.Error);
                Close();
            }
        }

        private async void OnConnectClick(object sender, RoutedEventArgs args) { await ConnectAsync(); }

        private async void OnDisconnectClick(object sender, RoutedEventArgs args) { await StopAsync(); }

        private void OnEnableCmdChecked(object sender, RoutedEventArgs args)
        {
            if (!initialized) return;
            if (MessageBox.Show(this, "CMD grants the connected relay permission to run arbitrary commands as your Windows user. Use only a trusted, access-controlled relay. Allow CMD?", "Remote command access", MessageBoxButton.YesNo, MessageBoxImage.Warning) != MessageBoxResult.Yes)
                enableCmd.IsChecked = false;
        }

        internal void ShowForeground()
        {
            if (closing) return;
            Show();
            if (WindowState == WindowState.Minimized) WindowState = WindowState.Normal;
            Activate();
        }

        private Task ConnectAsync()
        {
            if (!initialized || closing || running != null) return Task.FromResult(0);
            try
            {
                config.CloudUrl = cloud.Text.Trim();
                config.DeviceId = deviceId.Password.Trim();
                config.DeviceName = name.Text.Trim();
                config.EnableCmd = enableCmd.IsChecked == true;
                config.AutoConnectOnStartup = autoConnect.IsChecked == true;
                config.Save();
                cancellation = new CancellationTokenSource();
                stoppingTask = null;
                var desktop = new DesktopTools();
                var command = new WinPtyCommand();
                var relay = new RelayClient(config, async (tool, args, token) =>
                {
                    if (tool == "cmd.execute")
                    {
                        if (!config.EnableCmd) throw new InvalidOperationException("CMD is disabled. Enable remote CMD locally in the WPF agent.");
                        return await command.ExecuteAsync(args, token).ConfigureAwait(false);
                    }
                    if (tool == "file.read") return FileTools.Read(args);
                    return desktop.Call(tool, args);
                }, SetStatus);
                SetControls(false);
                running = Task.Run(() => relay.RunAsync(cancellation.Token));
            }
            catch (Exception error) { MessageBox.Show(this, error.Message, "Cannot connect", MessageBoxButton.OK, MessageBoxImage.Error); }
            return Task.FromResult(0);
        }

        private Task StopAsync()
        {
            if (stoppingTask != null) return stoppingTask;
            if (running == null) return Task.FromResult(0);
            stoppingTask = StopCoreAsync();
            return stoppingTask;
        }

        private async Task StopCoreAsync()
        {
            disconnect.IsEnabled = false;
            cancellation.Cancel();
            try { await running; }
            catch (Exception error) { SetStatus("Stopped: " + error.Message); }
            finally
            {
                running = null;
                cancellation.Dispose();
                cancellation = null;
                SetControls(true);
            }
        }

        private void SetControls(bool stopped)
        {
            cloud.IsEnabled = deviceId.IsEnabled = name.IsEnabled = enableCmd.IsEnabled = autoConnect.IsEnabled = connect.IsEnabled = stopped && !closing;
            disconnect.IsEnabled = !stopped && !closing;
        }

        private void SetStatus(string message)
        {
            if (Dispatcher.HasShutdownStarted) return;
            Dispatcher.BeginInvoke(new Action(delegate
            {
                state.Text = message;
                activity.AppendText(DateTime.Now.ToString("HH:mm:ss") + "  " + message + Environment.NewLine);
                if (activity.Text.Length > 20000) activity.Text = activity.Text.Substring(activity.Text.Length - 15000);
                activity.ScrollToEnd();
            }));
        }

        private async void OnClosing(object sender, CancelEventArgs args)
        {
            if (allowClose || running == null) return;
            args.Cancel = true;
            if (closing) return;
            closing = true;
            SetControls(false);
            await StopAsync();
            allowClose = true;
            await Dispatcher.InvokeAsync(new Action(Close));
        }
    }
}