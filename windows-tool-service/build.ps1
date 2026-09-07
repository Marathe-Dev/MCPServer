param(
    [ValidateSet('Debug', 'Release')][string]$Configuration = 'Release',
    [ValidateSet('x64', 'AnyCPU')][string]$Platform = 'x64',
    [switch]$NativeTest
)
# Optional headless test runner only; Visual Studio builds WindowsToolService.sln directly and does not need this script.
$ErrorActionPreference = 'Stop'
$arguments = @('/t:Build', "/p:Configuration=$Configuration", "/p:Platform=$Platform", '/nologo')
$project = Join-Path $PSScriptRoot 'WindowsToolService.Tests.csproj'
if (Get-Command msbuild -ErrorAction SilentlyContinue) { & msbuild $project @arguments }
else {
    $vswhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
    $msbuild = if (Test-Path $vswhere) { & $vswhere -latest -products * -requires Microsoft.Component.MSBuild -find 'MSBuild\**\Bin\MSBuild.exe' | Select-Object -First 1 }
    if (!$msbuild) { throw 'Install Visual Studio with .NET desktop development, or run from a Developer PowerShell with MSBuild on PATH.' }
    & $msbuild $project @arguments
}
if ($LASTEXITCODE -ne 0) { throw 'Test build failed.' }
$output = if ($Platform -eq 'AnyCPU') { "bin\Tests\AnyCPU\$Configuration" } else { "bin\Tests\$Configuration" }
$testExe = Join-Path $PSScriptRoot "$output\WindowsToolService.Tests.exe"
& $testExe @(if ($NativeTest) { '--native' })
if ($LASTEXITCODE -ne 0) { throw 'Smoke tests failed.' }
Write-Host "Tested: $testExe"