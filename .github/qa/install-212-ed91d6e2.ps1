# Unvibe private beta installer for Windows. Free AI explanations: 30 days without an account, monthly with one. Unsigned.
# Source: https://github.com/ShadowEsu/Unvibe/blob/main/marketing/src/lib/betaInstallScript.ts
# Sends one anonymous 'installed' count to unvibe.site when it finishes. No code or personal data.
# Paste this in Windows PowerShell or pwsh (not Command Prompt, not Git Bash):
# irm https://unvibe.site/install.ps1 | iex
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
try {
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls13
} catch {
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
}

$tag = if ($env:UNVIBE_BETA_TAG) { $env:UNVIBE_BETA_TAG } else { "v0.1.49" }
# UNVIBE_BETA_ASSET (for testing) must name a setup exe: it is run with /S.
$asset = if ($env:UNVIBE_BETA_ASSET) { $env:UNVIBE_BETA_ASSET } else { "Unvibe-0.1.49-win-x64-setup.exe" }
$url = "https://github.com/ShadowEsu/Unvibe/releases/download/$tag/$asset"
$work = Join-Path ([IO.Path]::GetTempPath()) ("unvibe-install-" + [guid]::NewGuid().ToString("N"))
$download = Join-Path $work $asset
$track = "https://unvibe.site/api/install/event"
$ua = "UnvibeBetaInstaller/0.1.49"

if ($env:OS -notlike "*Windows*") {
  Write-Error "This installer is for Windows. On a Mac run: curl -fsSL https://unvibe.site/install.sh | bash"
  exit 1
}

if (-not $PSVersionTable) {
  Write-Error "Run this in Windows PowerShell or pwsh, not cmd.exe. Example: irm https://unvibe.site/install.ps1 | iex"
  exit 1
}

if ($env:PROCESSOR_ARCHITECTURE -and $env:PROCESSOR_ARCHITECTURE -ne "AMD64" -and $env:PROCESSOR_ARCHITECTURE -ne "ARM64") {
  Write-Warning "This beta ships an x64 Windows build. On ARM PCs, Windows may run it under emulation."
}

New-Item -ItemType Directory -Force -Path $work | Out-Null
# throw, not exit: under irm | iex, exit closes the window before the message can be read.
function Stop-UnvibeInstall($message) {
  Remove-Item -Recurse -Force $work -ErrorAction SilentlyContinue
  throw "$message Nothing was installed. For help, see https://unvibe.site/install-help"
}

Write-Host "Checking release asset..."
try {
  $probe = Invoke-WebRequest -Method Head -Uri $url -UseBasicParsing -UserAgent $ua -MaximumRedirection 8
  if (-not $probe -or [int]$probe.StatusCode -ge 400) {
    Write-Error "Windows beta asset is missing at $url (HTTP $($probe.StatusCode)). The Mac install still works: curl -fsSL https://unvibe.site/install.sh | bash. Or open the latest release page: https://github.com/ShadowEsu/Unvibe/releases"
    exit 1
  }
} catch {
  Write-Error "Windows beta asset is missing or unreachable at $url. The Mac install still works: curl -fsSL https://unvibe.site/install.sh | bash. Or open https://github.com/ShadowEsu/Unvibe/releases. Details: $_"
  exit 1
}

Write-Host "Downloading Unvibe beta from $url ..."
$downloaded = $false
$curl = Get-Command curl.exe -ErrorAction SilentlyContinue
if ($curl) {
  & curl.exe -fL --retry 3 --retry-delay 2 -A $ua -o $download $url
  if ($LASTEXITCODE -eq 0 -and (Test-Path $download)) { $downloaded = $true }
}
if (-not $downloaded) {
  try {
    Invoke-WebRequest -Uri $url -OutFile $download -UseBasicParsing -UserAgent $ua -MaximumRedirection 8
    $downloaded = $true
  } catch {
    Stop-UnvibeInstall "Could not download $asset from release $tag. Open $url in a browser, or retry in PowerShell as Administrator. Details: $_"
  }
}
if (-not (Test-Path $download) -or (Get-Item $download).Length -lt 1000000) {
  Stop-UnvibeInstall "The download looks incomplete. Run the install command again, or download $url in your browser."
}
# Check the download against the SHA-256 published with the release. No checksum, no install.
$sumsUrl = "https://github.com/ShadowEsu/Unvibe/releases/download/$tag/SHA256SUMS-windows.txt"
try {
  $sums = (Invoke-WebRequest -Uri $sumsUrl -UseBasicParsing -UserAgent $ua -MaximumRedirection 8 -TimeoutSec 20).Content
  if ($sums -is [byte[]]) { $sums = [System.Text.Encoding]::UTF8.GetString($sums) }
} catch {
  Stop-UnvibeInstall "Could not download the published checksums from $sumsUrl, so the download can't be checked."
}
$line = ($sums -split "`n") | Where-Object { ($_.Trim() -split '\s+')[1] -in @($asset, "*$asset") } | Select-Object -First 1
if (-not $line) { Stop-UnvibeInstall "The published checksums have no line for $asset, so the download can't be checked." }
$expected = ($line.Trim() -split '\s+')[0].ToLower()
$actual = (Get-FileHash -Path $download -Algorithm SHA256).Hash.ToLower()
if ($expected -ne $actual) { Stop-UnvibeInstall "The download does not match the published checksum." }
Write-Host "Checksum verified."

Write-Host "Closing any running Unvibe..."
Get-Process -Name Unvibe -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

# Unvibe's Apps & features entry for this user (HKCU) or for everyone (HKLM). The key is the installer's
# app GUID (electron-builder: UUID v5 of the appId), so no other app's entry can match.
function Get-UnvibeUninstallEntry($root) {
  Get-ItemProperty -Path "$root\Software\Microsoft\Windows\CurrentVersion\Uninstall\f5687918-a052-548a-a713-e4a84dbef267" -ErrorAction SilentlyContinue
}
if (Get-UnvibeUninstallEntry "HKLM:") {
  Write-Warning "An Unvibe installed for all users is also on this PC. This installs a separate copy for your user; you can remove the other one in Settings > Apps > Installed apps."
}

Write-Host "Installing Unvibe for your Windows user (no administrator rights needed)..."
# /currentuser keeps the install per-user even next to an all-users copy (which would need an admin prompt).
# Wait for the installer process only: Start-Process -Wait would also wait for anything it starts.
try {
  $setup = Start-Process -FilePath $download -ArgumentList "/S", "/currentuser" -PassThru
} catch {
  Stop-UnvibeInstall "Could not start the Unvibe installer. Details: $_"
}
# Windows PowerShell 5.1 leaves ExitCode empty unless the process handle was read before it ended.
$null = $setup.Handle
if (-not $setup.WaitForExit(300000)) {
  Remove-Item -Recurse -Force $work -ErrorAction SilentlyContinue
  throw "The Unvibe installer did not finish within 5 minutes. Restart your PC, then run the install command again. For help, see https://unvibe.site/install-help"
}
if ($setup.ExitCode -ne 0) {
  Remove-Item -Recurse -Force $work -ErrorAction SilentlyContinue
  throw "The Unvibe installer stopped with code $($setup.ExitCode). Run the install command again. For help, see https://unvibe.site/install-help"
}

# Where this user's Unvibe is: its Apps & features entry names the exe (an earlier install may sit in a
# folder its owner chose); otherwise the installer's per-user default.
$installed = $null
for ($i = 0; $i -lt 30 -and -not $installed; $i++) {
  $fromEntry = Get-UnvibeUninstallEntry "HKCU:" | Where-Object { $_.DisplayIcon } |
    ForEach-Object { (($_.DisplayIcon -split ',')[0]).Trim('"') }
  $installed = @($fromEntry) + @(
    (Join-Path $env:LOCALAPPDATA "Programs\Unvibe\Unvibe.exe"),
    (Join-Path $env:LOCALAPPDATA "Programs\unvibe-app\Unvibe.exe")
  ) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
  if (-not $installed) { Start-Sleep -Seconds 1 }
}
Remove-Item -Recurse -Force $work -ErrorAction SilentlyContinue
if (-not $installed) {
  throw "The installer finished, but Unvibe.exe is not in its Apps & features entry or under $env:LOCALAPPDATA\Programs. For help, see https://unvibe.site/install-help"
}

# Earlier versions of this script kept a portable copy in LOCALAPPDATA\Unvibe. The installed app takes
# its place, and on its first start points an existing login item at itself.
foreach ($old in @("Unvibe.exe", "Unvibe.exe.download", "Unvibe.exe.old")) {
  Remove-Item -Force -Path (Join-Path (Join-Path $env:LOCALAPPDATA "Unvibe") $old) -ErrorAction SilentlyContinue
}

Write-Host "Opening Unvibe..."
Start-Process $installed
try {
  Invoke-RestMethod -Method Post -Uri $track -ContentType "application/json" -Body '{"event":"installed"}' -TimeoutSec 4 | Out-Null
} catch {}
Write-Host "Windows may warn that Unvibe is unsigned. That is expected during beta. If SmartScreen appears, choose More info, then Run anyway."
Write-Host "Done. Unvibe is installed for your Windows user: in your Start menu, on your desktop and in your tray. To remove it, use Settings > Apps > Installed apps."
