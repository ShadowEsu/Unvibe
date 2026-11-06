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
$asset = if ($env:UNVIBE_BETA_ASSET) { $env:UNVIBE_BETA_ASSET } else { "Unvibe-0.1.49-win-x64-portable.exe" }
$url = "https://github.com/ShadowEsu/Unvibe/releases/download/$tag/$asset"
$destDir = Join-Path $env:LOCALAPPDATA "Unvibe"
$dest = Join-Path $destDir "Unvibe.exe"
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

New-Item -ItemType Directory -Force -Path $destDir | Out-Null
# Download next to the app and only replace it once the download is verified, so a failed
# update leaves the working copy in place.
$download = "$dest.download"
if (Test-Path $download) { Remove-Item -Force $download }
# throw, not exit: under irm | iex, exit closes the window before the message can be read.
function Stop-UnvibeInstall($message) {
  Remove-Item -Force $download -ErrorAction SilentlyContinue
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
try {
  Move-Item -Force -Path $download -Destination $dest
} catch {
  Stop-UnvibeInstall "Could not replace $dest. Quit Unvibe from the tray, then run the install command again. Details: $_"
}
try { Unblock-File -Path $dest -ErrorAction Stop } catch {}

$shortcutPath = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\Unvibe.lnk"
$inStartMenu = $false
try {
  $shell = New-Object -ComObject WScript.Shell
  $shortcut = $shell.CreateShortcut($shortcutPath)
  $shortcut.TargetPath = $dest
  $shortcut.WorkingDirectory = $destDir
  $shortcut.IconLocation = "$dest,0"
  $shortcut.Description = "Unvibe"
  $shortcut.Save()
  $inStartMenu = $true
} catch {
  Write-Warning "Could not add Unvibe to the Start menu. Details: $_"
}

Write-Host "Opening Unvibe..."
Start-Process $dest
try {
  Invoke-RestMethod -Method Post -Uri $track -ContentType "application/json" -Body '{"event":"installed"}' -TimeoutSec 4 | Out-Null
} catch {}
Write-Host "Windows may warn that Unvibe is unsigned. That is expected during beta. If SmartScreen appears, choose More info, then Run anyway."
if ($inStartMenu) {
  Write-Host "Done. Unvibe is in your Start menu and tray."
} else {
  Write-Host "Done. Unvibe is in your tray. To open it again later, run $dest"
}
