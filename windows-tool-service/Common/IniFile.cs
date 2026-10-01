using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Text;
using System.IO;
using System.Threading.Tasks;

namespace WindowsToolService
{
    public class ConfigurationIniFile : IDisposable
    {
        #region IDisposable

        private bool disposedValue = false; // To detect redundant calls

        protected virtual void Dispose(bool disposing)
        {
            if (disposedValue)
            {
                return;
            }
            disposedValue = true;
        }

        ~ConfigurationIniFile()
        {
            Dispose(false);
        }

        public void Dispose()
        {
            Dispose(true);
            GC.SuppressFinalize(this);
        }

        #endregion IDisposable

        #region Declarations

        private readonly string EXE = Assembly.GetExecutingAssembly().GetName().Name;

        public static string RegSettingIniPath = string.Empty;

        private static object _lockObjectRegIni = new object();

        private static ConfigurationIniFile instance = null;

        public const string RPC_INI_FILE_NAME = "RPCSettings.ini";

        #endregion

        #region Dll Import section

        [DllImport("kernel32", SetLastError = true, CharSet = CharSet.Unicode)]
        static extern long WritePrivateProfileString(string Section, string Key, string Value, string FilePath);

        [DllImport("kernel32", SetLastError = true, CharSet = CharSet.Unicode)]
        static extern int GetPrivateProfileString(string Section, string Key, string Default, StringBuilder RetVal, int Size, string FilePath);

        #endregion

        #region ConfigurationIniFile Instance Creation
        /// <summary>
        /// GetInstance - Object creation for ConfigurationIniFile
        /// </summary>
        public static ConfigurationIniFile GetInstance
        {
            get
            {
                if (instance == null)
                {
                    lock (_lockObjectRegIni)
                    {
                        if (instance == null)
                        {
                            instance = new ConfigurationIniFile();

                            try
                            {
                                RegSettingIniPath = Path.Combine(App.AppDataFolderPath, RPC_INI_FILE_NAME);
                            }
                            catch (Exception)
                            {

                            }
                        }
                    }
                }

                return instance;
            }
        }
        #endregion

        #region Read key value
        /// <summary>
        /// Getting value for given key
        /// </summary>
        /// <param name="Key"></param>
        /// <param name="Section"></param>
        /// <returns></returns>
        public string Read(string Key, string Section)
        {
            var RetVal = new StringBuilder(512 * 100);
            GetPrivateProfileString(Section ?? EXE, Key, "", RetVal, RetVal.Capacity, RegSettingIniPath);
            return RetVal.ToString();
        }
        #endregion

        #region Write key value
        /// <summary>
        /// Write key value
        /// </summary>
        /// <param name="Key"></param>
        /// <param name="Value"></param>
        /// <param name="Section"></param>
        public void Write(string Key, string Value, string Section)
        {
            try
            {
                if ((string.IsNullOrEmpty(Key)) && (string.IsNullOrEmpty(Value)))
                {
                    WritePrivateProfileString(Section, null, null, RegSettingIniPath);
                }
            }
            catch (Exception)
            {

            }

            try
            {
                WritePrivateProfileString(Section ?? EXE, Key, Value, RegSettingIniPath);
            }
            catch (System.Exception)
            {

            }
        }
        #endregion

        #region Delete key
        /// <summary>
        /// Delete key
        /// </summary>
        /// <param name="Key"></param>
        /// <param name="Section"></param>
        public void DeleteKey(string Key, string Section)
        {
            Write(Key, null, Section ?? EXE);
        }
        #endregion

        #region Delete Section from Ini
        /// <summary>
        /// Delete Section in ini file
        /// </summary>
        /// <param name="Section"></param>
        public void DeleteSection(string Section)
        {
            Write(null, null, Section ?? EXE);
        }
        #endregion

        #region Checking give Key Exists or not
        /// <summary>
        /// Check whether key exist or not
        /// </summary>
        /// <param name="Key"></param>
        /// <param name="Section"></param>
        /// <returns></returns>
        public bool KeyExists(string Key, string Section)
        {
            return Read(Key, Section).Length > 0;
        }
        #endregion

        #region Jsonpath
        /// <summary>
        /// Get path for Json file
        /// </summary>
        /// <returns></returns>
        public string Jsonpath()
        {
            return RegSettingIniPath;
        }
        #endregion
    }
}
