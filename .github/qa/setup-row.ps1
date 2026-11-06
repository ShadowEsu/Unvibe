# One row of qa-setup-build.yml: a build-only setup.exe (one-click, per-user: #209) on a clean Windows runner.
# Usage: setup-row.ps1 -Kind dblclick|silent|upgrade|machine -Out <dir>    Env: INSTALL_ID, OLD (e.g. 0.1.49)
param([string]$Kind, [string]$Out)
$ErrorActionPreference = 'Continue'
New-Item -ItemType Directory -Force $Out | Out-Null
function Note($s) { $s | Tee-Object -FilePath "$Out\report.txt" -Append }
Add-Type -AssemblyName System.Windows.Forms, System.Drawing, UIAutomationClient, UIAutomationTypes
$shotN = 0
function Shot($name) {
  $script:shotN++
  $b = [System.Windows.Forms.SystemInformation]::VirtualScreen
  $bmp = New-Object System.Drawing.Bitmap $b.Width, $b.Height
  [System.Drawing.Graphics]::FromImage($bmp).CopyFromScreen($b.Left, $b.Top, 0, 0, $bmp.Size)
  $bmp.Save(("$Out\{0:d2}-$name.png" -f $script:shotN))
}
$AE = [System.Windows.Automation.AutomationElement]; $TA = [System.Windows.Automation.TreeScope]
$root = $AE::RootElement
function Find($name) { $root.FindFirst($TA::Descendants, (New-Object System.Windows.Automation.PropertyCondition($AE::NameProperty, $name))) }
function Press($el) { try { $el.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke(); $true } catch { Note "  press '$($el.Current.Name)': $($_.Exception.Message)"; $false } }
function Titled() { (Get-Process | Where-Object { $_.MainWindowTitle } | ForEach-Object { "$($_.ProcessName): $($_.MainWindowTitle)" }) -join ' | ' }
Add-Type @"
using System; using System.Runtime.InteropServices;
public static class Fg {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
}
"@
function Front() { $h = [Fg]::GetForegroundWindow(); $fp = [uint32]0; [void][Fg]::GetWindowThreadProcessId($h, [ref]$fp); $q = Get-Process -Id $fp -ErrorAction SilentlyContinue; "$($q.ProcessName): $($q.MainWindowTitle)" }
function Entries() {
  foreach ($k in 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall', 'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall', 'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall') {
    Get-ChildItem $k -ErrorAction SilentlyContinue | ForEach-Object { $p = Get-ItemProperty $_.PSPath; if ($p.DisplayName -like 'Unvibe*') { [pscustomobject]@{ Hive = ($k -split ':')[0]; Key = $_.PSChildName; Name = $p.DisplayName; Version = $p.DisplayVersion; Location = $p.InstallLocation; Uninstall = $p.UninstallString; Quiet = $p.QuietUninstallString } } }
  }
}
function Exes() { Get-ChildItem "$env:LOCALAPPDATA\Programs", "$env:ProgramFiles", "${env:ProgramFiles(x86)}" -Recurse -Filter 'Unvibe.exe' -ErrorAction SilentlyContinue | ForEach-Object { "$($_.FullName) ($((Get-Item $_.FullName).VersionInfo.ProductVersion))" } }
function Links() { Get-ChildItem (Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'), (Join-Path $env:ProgramData 'Microsoft\Windows\Start Menu\Programs') -Recurse -Filter 'Unvibe*.lnk' -ErrorAction SilentlyContinue | ForEach-Object { "$($_.FullName) -> $((New-Object -ComObject WScript.Shell).CreateShortcut($_.FullName).TargetPath)" } }
function State($label) {
  Note "STATE $label"
  Note "  exes: $((@(Exes)) -join ' | ')"
  Note "  Apps entries: $((@(Entries) | ForEach-Object { "[$($_.Hive)] key '$($_.Key)' '$($_.Name)' $($_.Version) at $($_.Location)" }) -join ' | ')"
  Note "  Start menu: $((@(Links)) -join ' | ')"
  Note "  desktop shortcut: $(Test-Path (Join-Path ([Environment]::GetFolderPath('Desktop')) 'Unvibe.lnk')), public desktop: $(Test-Path (Join-Path $env:PUBLIC 'Desktop\Unvibe.lnk'))"
  Note "  Unvibe running: $(@(Get-Process Unvibe -ErrorAction SilentlyContinue).Count) processes"
}
function RunWait($file, $argList) {
  $p = Start-Process -FilePath $file -ArgumentList $argList -PassThru; $null = $p.Handle
  if (-not $p.WaitForExit(600000)) { Note "FAIL  $file $argList still running after 10 min" }
  $p.ExitCode
}
# The earlier release's assisted setup sometimes exits 0xC0000005 on a fresh Server 2025 and installs nothing
# (run 42195819986's 2025 upgrade row). Its install is only this row's starting point: up to 3 tries, each crash noted.
function OldInstall($argList) {
  for ($try = 1; $try -le 3; $try++) {
    $code = RunWait (Old) $argList
    Note "v$env:OLD setup $argList exit $code (try $try)"
    if ($code -ne -1073741819) { return $code }
    Note "NOTE  v$env:OLD setup crashed with 0xC0000005 (try $try)"; Start-Sleep 5
  }
  $code
}
function Old() { # the earlier release's assisted setup.exe
  $f = "$env:RUNNER_TEMP\Unvibe-$env:OLD-win-x64-setup.exe"
  if (-not (Test-Path $f)) { Invoke-WebRequest -Uri "https://github.com/ShadowEsu/Unvibe/releases/download/v$env:OLD/Unvibe-$env:OLD-win-x64-setup.exe" -OutFile $f -UseBasicParsing }
  $f
}

$os = Get-CimInstance Win32_OperatingSystem
Note "ROW setup-$Kind on $($os.Caption) build $($os.BuildNumber); admin: $(([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator))"
$new = (Get-ChildItem "$env:RUNNER_TEMP\build" -Recurse -Filter '*-win-x64-setup.exe' | Select-Object -First 1).FullName
Note "build setup.exe: $(Split-Path $new -Leaf), $((Get-Item $new).Length) bytes, sha256 $((Get-FileHash $new -Algorithm SHA256).Hash.ToLower()), version $((Get-Item $new).VersionInfo.ProductVersion)"
# The app's profile gets this run's qa- id before anything launches (it was flagged by the workflow already).
$storeDir = Join-Path $env:APPDATA 'Unvibe'; New-Item -ItemType Directory -Force $storeDir | Out-Null
Set-Content -Path (Join-Path $storeDir 'unvibe-store.json') -Value "{`"installId`":`"$env:INSTALL_ID`"}" -Encoding ascii -NoNewline
State 'clean runner'

# #208: a background watcher pictures the first visible main window the moment it shows (first-paint.ps1).
function Watch($tag) { Start-Process powershell.exe -ArgumentList '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "$PSScriptRoot\first-paint.ps1", '-Out', $Out, '-Tag', $tag -PassThru -WindowStyle Hidden }
function WatchResult($p, $tag) {
  if (-not $p) { return }
  $null = $p.Handle; [void]$p.WaitForExit(180000)
  $lines = @(Get-Content (Join-Path $Out "first-paint-$tag.txt") -ErrorAction SilentlyContinue)
  $lines | ForEach-Object { Note "  #208 $tag`: $_" }
  $first = $lines | Where-Object { $_ -like 'first visible*' } | Select-Object -First 1
  $later = $lines | Where-Object { $_ -like '3 s later*' } | Select-Object -First 1
  $pct = if ($first -match 'most common colour ([\d.]+)%') { [double]$Matches[1] } else { 100 }
  $cols = if ($first -match '([\d]+) colours') { [int]$Matches[1] } else { 0 }
  Note "$(if ($first -and $pct -lt 97 -and $cols -ge 20) { 'PASS' } else { 'FAIL' })  #208 $tag`: the window has content when it first shows (client area: most common colour $pct%, $cols colours; an empty page is ~100% / under 20)"
  Note "$(if ($first -match 'in front: True') { 'PASS' } else { 'FAIL' })  #208 $tag`: in front when it first shows"
  Note "$(if ($later -match 'main windows: 1;') { 'PASS' } else { 'FAIL' })  #208 $tag`: one main window 3 s later"
}
$watch = $null
function DoubleClick($file) {
  $dl = "$env:USERPROFILE\Downloads\$(Split-Path $file -Leaf)"
  Copy-Item $file $dl -Force
  Set-Content -Path $dl -Stream Zone.Identifier -Value "[ZoneTransfer]`r`nZoneId=3`r`nReferrerUrl=https://unvibe.site/`r`nHostUrl=https://github.com/ShadowEsu/Unvibe/releases/download/x/$(Split-Path $file -Leaf)"
  Note "double-click $(Split-Path $dl -Leaf) (Mark of the Web ZoneId=3)"
  if ($Kind -eq 'dblclick') { $script:watch = Watch 'first-launch' }
  Start-Process explorer.exe -ArgumentList "`"$dl`""
  Start-Sleep 10
  Shot 'smartscreen'
  $more = Find 'More info'
  if ($more) {
    Note 'PROMPT SmartScreen: "Windows protected your PC", More info'
    [void](Press $more); Start-Sleep 3; Shot 'smartscreen-more-info'
    $run = Find 'Run anyway'
    if ($run) { Note 'PROMPT SmartScreen: Run anyway'; [void](Press $run) } else { Note 'FAIL  SmartScreen: no Run anyway' }
  } else { Note 'no SmartScreen prompt' }
  # Every screen while it installs: one picture every 2 s for 40 s, with the titled windows and any setup page.
  for ($i = 1; $i -le 20; $i++) {
    Start-Sleep 2
    $setupWin = Get-Process | Where-Object { $_.ProcessName -like '*-setup' -and $_.MainWindowHandle -ne 0 } | Select-Object -First 1
    $line = "  +$($i * 2) s: $(Titled)"
    if ($setupWin) { $line += " | SETUP WINDOW '$($setupWin.MainWindowTitle)'"; Shot "installer-$($i * 2)s" }
    elseif ($i -in 1, 2, 3, 5, 10, 20) { Shot "after-run-anyway-$($i * 2)s" }
    Note $line
    if (Get-Process Unvibe -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 }) { Note "  Unvibe window up after about $($i * 2) s"; break }
  }
}

switch ($Kind) {
  'dblclick' { DoubleClick $new }
  'silent' {
    $code = RunWait $new '/S'
    Start-Sleep 5
    $running = @(Get-Process Unvibe -ErrorAction SilentlyContinue).Count
    Note "$(if ($code -eq 0) { 'PASS' } else { 'FAIL' })  /S exit $code"
    Note "$(if ($running -eq 0) { 'PASS' } else { 'FAIL' })  /S does not start the app ($running Unvibe processes 5 s after)"
  }
  'upgrade' {
    [void](OldInstall '/S')
    State "after v$env:OLD /S"
    # I-2 (Security): the old app runs once for real (onboarding, then a follow-up so the send agreement is ticked),
    # so the store has an install id and a consent record to keep.
    $oldExe = "$env:LOCALAPPDATA\Programs\Unvibe\Unvibe.exe"
    $env:UNVIBE_EXE = $oldExe; $env:USER_DATA = $storeDir; $env:OUT = "$Out\old"; $env:UNVIBE_OS = 'windows'; $env:NODE_PATH = "$env:RUNNER_TEMP\pw\node_modules"; $env:AGREE = '1'
    $j = Start-Process node -ArgumentList "$env:RUNNER_TEMP\pw\first-explain.mjs" -RedirectStandardOutput "$Out\old-explain.log" -RedirectStandardError "$Out\old-explain.err" -PassThru; $null = $j.Handle
    if (-not $j.WaitForExit(420000)) { $j | Stop-Process -Force }
    Remove-Item Env:AGREE
    Get-Content "$Out\old\explain-report.txt" -ErrorAction SilentlyContinue | ForEach-Object { Note "  v$env:OLD run: $_" }
    Get-Process Unvibe -ErrorAction SilentlyContinue | Stop-Process -Force; Start-Sleep 2
    $beforeId = (Get-Content (Join-Path $storeDir 'unvibe-store.json') -Raw | ConvertFrom-Json).installId
    $consentFile = Join-Path $storeDir 'unvibe-consent.json'
    $beforeConsent = if (Test-Path $consentFile) { (Get-FileHash $consentFile -Algorithm SHA256).Hash } else { 'none' }
    Note "before upgrade: install id $beforeId; consent file $(if (Test-Path $consentFile) { "present, sha256 $beforeConsent, $((Get-Content $consentFile -Raw).Length) chars" } else { 'MISSING' })"
    DoubleClick $new
    Start-Sleep 5
    Get-Process Unvibe -ErrorAction SilentlyContinue | Stop-Process -Force; Start-Sleep 2
    $afterId = (Get-Content (Join-Path $storeDir 'unvibe-store.json') -Raw | ConvertFrom-Json).installId
    $afterConsent = if (Test-Path $consentFile) { (Get-FileHash $consentFile -Algorithm SHA256).Hash } else { 'none' }
    Note "$(if ($afterId -eq $beforeId -and $beforeId) { 'PASS' } else { 'FAIL' })  I-2 install id kept across the upgrade ($beforeId -> $afterId)"
    Note "$(if ($beforeConsent -ne 'none' -and $afterConsent -eq $beforeConsent) { 'PASS' } else { 'FAIL' })  I-2 consent record kept across the upgrade (sha256 before $beforeConsent, after $afterConsent)"
    # The new build reopens after the double-click: start it again for the first-window check below.
    Start-Process "$env:LOCALAPPDATA\Programs\Unvibe\Unvibe.exe"
  }
  'machine' {
    [void](OldInstall '/allusers /S') # "Anyone who uses this computer"
    State "after v$env:OLD for all users"
    DoubleClick $new
    Start-Sleep 5
    # I-3 (Security): with both copies installed, start each and see which runs and whether a second one stays up
    # next to the first (the app takes a single-instance lock per profile; both share %APPDATA%\Unvibe).
    Get-Process Unvibe -ErrorAction SilentlyContinue | Stop-Process -Force; Start-Sleep 2
    $copies = @(Exes | ForEach-Object { $_ -replace ' \(.*\)$', '' })
    foreach ($c in $copies) { Start-Process $c; Start-Sleep 12; Note "  started $c -> running Unvibe main processes: $((@(Get-Process Unvibe -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 }) | ForEach-Object { $_.Path }) -join ', ')" }
    Shot 'both-copies-started'
    $paths = @(Get-Process Unvibe -ErrorAction SilentlyContinue | ForEach-Object { $_.Path } | Sort-Object -Unique)
    Note "NOTE  I-3: $($copies.Count) installed copies; processes running from: $($paths -join ' | '); both running at once: $($paths.Count -gt 1)"
    Get-Process Unvibe -ErrorAction SilentlyContinue | Stop-Process -Force; Start-Sleep 2
    Start-Process "$env:LOCALAPPDATA\Programs\Unvibe\Unvibe.exe"
  }
}
Start-Sleep 5
State 'after this build'
$entries = @(Entries); $exes = @(Exes)
$want = "$env:LOCALAPPDATA\Programs\Unvibe\Unvibe.exe"
switch ($Kind) {
  'machine' { Note "NOTE  machine-wide then per-user: $($exes.Count) Unvibe.exe, $($entries.Count) Apps entries (the reviewer expects 2 copies)" }
  default {
    Note "$(if (Test-Path $want) { 'PASS' } else { 'FAIL' })  installed at $want"
    Note "$(if ($entries.Count -eq 1) { 'PASS' } else { 'FAIL' })  exactly one Apps entry ($($entries.Count))"
    Note "$(if (@(Links).Count -ge 1) { 'PASS' } else { 'FAIL' })  Start menu entry"
  }
}

# First window: the build opens itself after a double-click (runAfterFinish); /S needs a launch, as install.ps1 does.
$win = Get-Process Unvibe -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
$exe = if (Test-Path $want) { $want } else { ($exes | Select-Object -First 1) -replace ' \(.*\)$', '' }
# #208 reopen while loading: the silent row starts the app, then starts it again 300 ms later, before it has painted.
if (-not $win -and $Kind -eq 'silent') {
  $watch = Watch 'reopen-while-loading'; Start-Sleep 1
  Note "launching $exe (as install.ps1 will), and again 300 ms later"
  Start-Process $exe; Start-Sleep -Milliseconds 300; Start-Process $exe
}
if ($Kind -eq 'dblclick' -and -not $win) { Note 'FAIL  the installer did not open Unvibe (runAfterFinish)' }
for ($i = 0; $i -lt 45 -and -not $win; $i++) { Start-Sleep 2; $win = Get-Process Unvibe -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1 }
$front = Front
Shot 'first-window'
if ($win) { Note "$(if ($front -like 'Unvibe: *') { 'PASS' } else { 'FAIL' })  first window in front ('$front'), from $($win.Path)" } else { Note 'FAIL  no Unvibe window' }
WatchResult $watch $(if ($Kind -eq 'silent') { 'reopen-while-loading' } else { 'first-launch' })

# First explanation on the same profile.
Get-Process Unvibe -ErrorAction SilentlyContinue | Stop-Process -Force; Start-Sleep 3
if ($exe -and (Test-Path $exe)) {
  $env:UNVIBE_EXE = $exe; $env:USER_DATA = $storeDir; $env:OUT = $Out; $env:UNVIBE_OS = 'windows'; $env:NODE_PATH = "$env:RUNNER_TEMP\pw\node_modules"
  $j = Start-Process node -ArgumentList "$env:RUNNER_TEMP\pw\first-explain.mjs" -RedirectStandardOutput "$Out\explain.log" -RedirectStandardError "$Out\explain.err" -PassThru; $null = $j.Handle
  if (-not $j.WaitForExit(420000)) { $j | Stop-Process -Force; Note 'FAIL  first explanation: no result in 7 min' }
  if (Test-Path "$Out\explain-report.txt") { Get-Content "$Out\explain-report.txt" | ForEach-Object { Note "  $_" } }
} else { Note 'FAIL  first explanation: no installed exe' }
Get-Process Unvibe -ErrorAction SilentlyContinue | Stop-Process -Force

# Uninstall every Unvibe entry the way Settings does, silently.
foreach ($e in @(Entries)) {
  $cmd = if ($e.Quiet) { $e.Quiet } else { "$($e.Uninstall) /S" }
  Note "uninstalling [$($e.Hive)] '$($e.Name)': $cmd"
  Start-Process cmd.exe -ArgumentList '/c', $cmd -WindowStyle Hidden
  for ($i = 0; $i -lt 30 -and (@(Entries) | Where-Object { $_.Key -eq $e.Key -and $_.Hive -eq $e.Hive }); $i++) { Start-Sleep 2 }
}
Start-Sleep 5
State 'after uninstall'
$left = @(Exes).Count + @(Entries).Count + @(Links).Count
Note "$(if ($left -eq 0) { 'PASS' } else { 'FAIL' })  uninstall: app, Apps entry and Start menu entry all gone ($left left)"
# I-4 (Security): the learning data folder stays after uninstall; recorded for the help text.
Note "NOTE  I-4 after uninstall, $storeDir exists: $(Test-Path $storeDir); files: $((Get-ChildItem $storeDir -ErrorAction SilentlyContinue | ForEach-Object { $_.Name }) -join ', ')"
if (Select-String -Path "$Out\report.txt" -Pattern '^\s*FAIL' -Quiet) { exit 1 }
exit 0
