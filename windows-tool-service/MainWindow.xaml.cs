using System;
using System.ComponentModel;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Input;

namespace WindowsToolService
{
    /// <summary>
    /// Interaction logic for MainWindow.xaml — the desktop agent window.
    /// Loads settings, connects to the cloud relay, and shows live activity.
    /// </summary>
    public partial class MainWindow : Window
    {
        // ── State ─────────────────────────────────────────────────────────────
        private AgentConfig _config;
        private CancellationTokenSource _cancellation;
        private Task _running;      // active relay loop; null when stopped
        private Task _stopping;     // cached stop task; keeps StopAsync idempotent
        private bool _initialized;  // true once settings are loaded into the UI
        private bool _closing;
        private bool _allowClose;

        // ── Constructors ──────────────────────────────────────────────────────

        /// <summary>Parameterless ctor for the XAML designer and normal startup.</summary>
        public MainWindow() : this(null) { }

        /// <summary>Injection ctor for tests — supplies a config instead of loading from disk.</summary>
        internal MainWindow(AgentConfig config)
        {
            InitializeComponent();
            _config = config;
        }

        // ── Window chrome (borderless) ────────────────────────────────────────

        /// <summary>Lets the user drag the borderless window.</summary>
        private void Window_MouseLeftButtonDown(object sender, MouseButtonEventArgs e)
        {
            if (e.ButtonState == MouseButtonState.Pressed) DragMove();
        }

        private void Minimize_Click(object sender, RoutedEventArgs e) => WindowState = WindowState.Minimized;

        private void Cancel_Click(object sender, RoutedEventArgs e) => Close();

        // ── Startup ───────────────────────────────────────────────────────────

        /// <summary>Loads saved settings into the fields, then auto-connects if enabled.</summary>
        private async void Window_Loaded(object sender, RoutedEventArgs e)
        {
            if (_initialized || DesignerProperties.GetIsInDesignMode(this)) return;

            try
            {
                _config = _config ?? AgentConfig.Load();
                cloud.Text = _config.CloudUrl;
                deviceId.Password = _config.DeviceId;
                name.Text = _config.DeviceName;
                enableCmd.IsChecked = _config.EnableCmd;
                autoConnect.IsChecked = _config.AutoConnectOnStartup;
                _initialized = true;

                ShowForeground();
                if (_config.AutoConnectOnStartup) await ConnectAsync();
            }
            catch (Exception error)
            {
                MessageBox.Show(this, error.Message, "Cannot load settings", MessageBoxButton.OK, MessageBoxImage.Error);
                Close();
            }
        }

        // ── Button handlers ───────────────────────────────────────────────────

        private async void Connect_Click(object sender, RoutedEventArgs e) => await ConnectAsync();

        private async void Disconnect_Click(object sender, RoutedEventArgs e) => await StopAsync();

        /// <summary>Warns before enabling remote CMD; reverts the checkbox if declined.</summary>
        private void EnableCmd_Checked(object sender, RoutedEventArgs e)
        {
            if (!_initialized) return;

            const string message = "CMD lets the connected relay run arbitrary commands as your Windows user. " +
                                   "Use only a trusted, access-controlled relay. Allow CMD?";
            if (MessageBox.Show(this, message, "Remote command access", MessageBoxButton.YesNo, MessageBoxImage.Warning) != MessageBoxResult.Yes)
                enableCmd.IsChecked = false;
        }

        // ── Connect / disconnect ──────────────────────────────────────────────

        /// <summary>Saves the settings and starts the relay loop on a background task.</summary>
        private Task ConnectAsync()
        {
            if (!_initialized || _closing || _running != null) return Task.FromResult(0);

            try
            {
                _config.CloudUrl = cloud.Text.Trim();
                _config.DeviceId = deviceId.Password.Trim();
                _config.DeviceName = name.Text.Trim();
                _config.EnableCmd = enableCmd.IsChecked == true;
                _config.AutoConnectOnStartup = autoConnect.IsChecked == true;
                _config.Save();

                _cancellation = new CancellationTokenSource();
                _stopping = null;

                // One object routes every tool (desktop input, CMD, file read) through its switch.
                var tools = new DesktopTools(_config);
                var relay = new RelayClient(_config, tools.CallAsync, SetStatus);

                SetControls(stopped: false);
                _running = Task.Run(() => relay.RunAsync(_cancellation.Token));
            }
            catch (Exception error)
            {
                MessageBox.Show(this, error.Message, "Cannot connect", MessageBoxButton.OK, MessageBoxImage.Error);
            }
            return Task.FromResult(0);
        }

        /// <summary>Stops the relay loop; safe to call repeatedly.</summary>
        private Task StopAsync()
        {
            if (_stopping != null) return _stopping;
            if (_running == null) return Task.FromResult(0);
            _stopping = StopCoreAsync();
            return _stopping;
        }

        private async Task StopCoreAsync()
        {
            disconnect.IsEnabled = false;
            _cancellation.Cancel();

            try { await _running; }
            catch (Exception error) { SetStatus("Stopped: " + error.Message); }
            finally
            {
                _running = null;
                _cancellation.Dispose();
                _cancellation = null;
                SetControls(stopped: true);
            }
        }

        // ── UI helpers ────────────────────────────────────────────────────────

        /// <summary>Brings the single-instance window back to the foreground.</summary>
        internal void ShowForeground()
        {
            if (_closing) return;
            Show();
            if (WindowState == WindowState.Minimized) WindowState = WindowState.Normal;
            Activate();
        }

        /// <summary>Enables the settings + Connect controls when stopped, Disconnect when running.</summary>
        private void SetControls(bool stopped)
        {
            cloud.IsEnabled = deviceId.IsEnabled = name.IsEnabled =
                enableCmd.IsEnabled = autoConnect.IsEnabled = connect.IsEnabled = stopped && !_closing;
            disconnect.IsEnabled = !stopped && !_closing;
        }

        /// <summary>Shows the latest status and appends a timestamped line to the bounded log.</summary>
        private void SetStatus(string message)
        {
            if (Dispatcher.HasShutdownStarted) return;

            Dispatcher.BeginInvoke(new Action(delegate
            {
                state.Text = message;
                activity.AppendText(DateTime.Now.ToString("HH:mm:ss") + "  " + message + Environment.NewLine);

                // Keep the log bounded so it never grows without limit.
                if (activity.Text.Length > 20000)
                    activity.Text = activity.Text.Substring(activity.Text.Length - 15000);

                activity.ScrollToEnd();
            }));
        }

        // ── Closing ───────────────────────────────────────────────────────────

        /// <summary>Disconnects gracefully before the window actually closes.</summary>
        private async void Window_Closing(object sender, CancelEventArgs e)
        {
            if (_allowClose || _running == null) return;

            e.Cancel = true;
            if (_closing) return;
            _closing = true;

            SetControls(stopped: false);
            await StopAsync();
            _allowClose = true;
            await Dispatcher.InvokeAsync(new Action(Close));
        }
    }
}