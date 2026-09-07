# WinPTY Dependency

These binaries are gitignored and not committed. One-time manual setup only —
neither Visual Studio nor `build.ps1` fetches them automatically:

1. Download `winpty-0.4.3-msvc2015.zip` from
   https://github.com/rprichard/winpty/releases/tag/0.4.3
2. Verify: `Get-FileHash winpty-0.4.3-msvc2015.zip -Algorithm SHA256` must equal
   `35A48ECE2FF4ACDCBC8299D4920DE53EB86B1FB41E64D2FE5AE7898931BCEE89`.
3. Extract, then copy `x64\bin\winpty.dll` and `x64\bin\winpty-agent.exe` into
   this `native\` folder (and `LICENSE` as `WINPTY-LICENSE.txt`).

`WindowsToolService.csproj` includes these as `Content` only if present
(`Condition="Exists(...)"`), so a build without them still succeeds, but CMD
execution fails at runtime until they're restored.

Source and ABI: https://github.com/rprichard/winpty

The MSVC 2015 build may require Microsoft's Visual C++ 2015-2022 x64
Redistributable. Do not mix architectures or DLL and agent release versions.

## Any CPU deployments

Any CPU controls the managed EXE, not these native binaries. With Prefer 32-bit
disabled, it runs as x64 on 64-bit Windows and x86 on 32-bit Windows. The existing
`native` folder contains the x64 pair and all builds copy that pair unchanged.

For 32-bit Windows, take `x86\bin\winpty.dll` and `x86\bin\winpty-agent.exe`
from the same verified archive and replace the pair in the **Any CPU deployment
folder after building**. Use the x86 Visual C++ redistributable if required.
Do not replace the source x64 pair or use an x64 EXE on 32-bit Windows. This creates
two native deployment packages without needing two managed Any CPU builds.