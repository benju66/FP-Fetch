#Requires -Version 5.1
<#
  Sets up the FP Fetch native messaging host:
  1) Ensures Python 3 is available (optional winget install)
  2) Creates venv and installs pywin32
  3) Writes com.fpfetch.native_host.json
  4) Registers Chrome (and Edge) Native Messaging host under HKCU

  Usage:
    .\setup.ps1 -ExtensionId "abcdefghijklmnopqrstuvwxyz123456"
    .\setup.ps1 -InstallPython -ExtensionId "yourid"

  Get Extension ID: Chrome -> Extensions -> Developer mode -> ID under FP Fetch.
#>
param(
    [Parameter(Mandatory = $false)]
    [string]$ExtensionId = "",

    [switch]$InstallPython
)

$ErrorActionPreference = "Stop"
$BackendRoot = $PSScriptRoot

function Get-PythonCmd {
    foreach ($exe in @("python", "python3")) {
        $cmd = Get-Command $exe -ErrorAction SilentlyContinue
        if ($cmd) {
            $ver = & $exe -c "import sys; print(sys.version_info[0])" 2>$null
            if ($ver -eq "3") { return $exe }
        }
    }
    return $null
}

$python = Get-PythonCmd
if (-not $python -and $InstallPython) {
    Write-Host "Installing Python 3 via winget..."
    winget install -e --id Python.Python.3.12 --accept-package-agreements --accept-source-agreements
    $machine = [Environment]::GetEnvironmentVariable("Path", "Machine")
    $user = [Environment]::GetEnvironmentVariable("Path", "User")
    $env:Path = "$machine;$user"
    $python = Get-PythonCmd
}

if (-not $python) {
    Write-Host @"
Python 3 was not found on PATH.

Install it using either:
  winget install Python.Python.3.12

Or download: https://www.python.org/downloads/windows/
  (Check 'Add python.exe to PATH' during setup.)

Then run this script again, or re-run with -InstallPython
"@
    exit 1
}

Write-Host "Using: $python"
Set-Location $BackendRoot

Write-Host "Creating virtual environment..."
& $python -m venv venv

$pyvenv = Join-Path $BackendRoot "venv\Scripts\python.exe"

Write-Host "Installing dependencies..."
& $pyvenv -m pip install --upgrade pip | Out-Host
& $pyvenv -m pip install -r (Join-Path $BackendRoot "requirements.txt") | Out-Host

$batPath = Join-Path $BackendRoot "run_host.bat"
$batPath = [System.IO.Path]::GetFullPath($batPath)

if (-not $ExtensionId) {
    $ExtensionId = Read-Host "Paste your Chrome Extension ID (32 chars, from chrome://extensions)"
}
$ExtensionId = $ExtensionId.Trim()
if ($ExtensionId.Length -lt 20) {
    Write-Warning "Extension ID looks unusual; Chrome IDs are usually 32 characters."
}

$manifestPath = Join-Path $BackendRoot "com.fpfetch.native_host.json"
$manifestObj = [ordered]@{
    name              = "com.fpfetch.native_host"
    path              = $batPath
    type              = "stdio"
    allowed_origins   = @("chrome-extension://$ExtensionId/")
}
$json = $manifestObj | ConvertTo-Json -Depth 5 -Compress
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($manifestPath, $json, $utf8NoBom)
Write-Host "Wrote manifest: $manifestPath"

$manifestPathFull = [System.IO.Path]::GetFullPath($manifestPath)

$regAdds = @(
    'HKCU\Software\Google\Chrome\NativeMessagingHosts\com.fpfetch.native_host',
    'HKCU\Software\Microsoft\Edge\NativeMessagingHosts\com.fpfetch.native_host'
)
foreach ($key in $regAdds) {
    reg add $key /ve /t REG_SZ /d "$manifestPathFull" /f | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "reg add failed for $key" }
    Write-Host "Registered: $key"
}

Write-Host @"

Done. Native host name for chrome.runtime.connectNative: com.fpfetch.native_host

Reload the extension in chrome://extensions after changing the manifest or this registration.
"@
