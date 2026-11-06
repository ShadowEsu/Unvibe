# One Windows row of qa-install-matrix.yml: install Unvibe the way the site offers it, record every warning Windows
# shows, see the first launch, flag the install as QA right away, then the first explanation (first-explain.mjs).
# Usage: win-row.ps1 -Kind ps1|exe|setup|setupexe -Out <dir>   Env: INSTALL_ID (qa-…), UNVIBE_QA_FLAG_TOKEN, V (e.g. 0.1.49)
#   ps1, exe    the two paths the site offers today (both the portable exe)
#   setup       the NSIS Unvibe-<v>-win-x64-setup.exe run silently (/S) and then launched, as the new install.ps1 will
#   setupexe    the same setup.exe saved by a browser (Mark of the Web) and double-clicked, as the site's link will
#   BOSS row 545 gate for switching to setup.exe: Start menu entry, uninstall, first window in front, first explanation.
param([string]$Kind, [string]$Out)
$ErrorActionPreference = 'Continue'
New-Item -ItemType Directory -Force $Out | Out-Null
function Note($s) { $s | Tee-Object -FilePath "$Out\report.txt" -Append }
Add-Type -AssemblyName System.Windows.Forms, System.Drawing, UIAutomationClient, UIAutomationTypes
function Shot($name) {
  $b = [System.Windows.Forms.SystemInformation]::VirtualScreen
  $bmp = New-Object System.Drawing.Bitmap $b.Width, $b.Height
  [System.Drawing.Graphics]::FromImage($bmp).CopyFromScreen($b.Left, $b.Top, 0, 0, $bmp.Size)
  $bmp.Save("$Out\$name.png")
}
$root = [System.Windows.Automation.AutomationElement]::RootElement
function Find($name) { $root.FindFirst([System.Windows.Automation.TreeScope]::Descendants, (New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty, $name))) }
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
function UninstallEntry() {
  Get-ChildItem 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall', 'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall', 'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall' -ErrorAction SilentlyContinue |
    ForEach-Object { Get-ItemProperty $_.PSPath } | Where-Object { $_.DisplayName -like 'Unvibe*' } | Select-Object -First 1
}
function StartMenuLinks() {
  Get-ChildItem (Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'), (Join-Path $env:ProgramData 'Microsoft\Windows\Start Menu\Programs') -Recurse -Filter 'Unvibe*.lnk' -ErrorAction SilentlyContinue
}
$isSetup = $Kind -in 'setup', 'setupexe'

$os = Get-CimInstance Win32_OperatingSystem
Note "ROW win-$Kind on $($os.Caption) $($os.Version) build $($os.BuildNumber)"
foreach ($k in 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer', 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\System') {
  $p = Get-ItemProperty $k -ErrorAction SilentlyContinue
  Note "$k SmartScreenEnabled=$($p.SmartScreenEnabled) EnableSmartScreen=$($p.EnableSmartScreen)"
}
# The profile the app uses on its first launch gets this run's qa- install id before anything starts.
$storeDir = Join-Path $env:APPDATA 'Unvibe'; $store = Join-Path $storeDir 'unvibe-store.json'
New-Item -ItemType Directory -Force $storeDir | Out-Null
Set-Content -Path $store -Value "{`"installId`":`"$env:INSTALL_ID`"}" -Encoding ascii -NoNewline
Note "seeded install id $env:INSTALL_ID"

function Flag($label) {
  for ($i = 0; $i -lt 12; $i++) {
    try {
      $r = Invoke-WebRequest -Method Post -Uri 'https://api.unvibe.site/api/v1/admin/qa-install' -UseBasicParsing `
        -Headers @{ authorization = "Bearer $env:UNVIBE_QA_FLAG_TOKEN" } -ContentType 'application/json' `
        -Body (@{ installId = $env:INSTALL_ID } | ConvertTo-Json -Compress)
      $m = ($r.Content | ConvertFrom-Json).matched
      if ($r.StatusCode -eq 200 -and $m) { Note "QA flag ($label): 200 matched=true"; return $true }
    } catch { $m = "error $($_.Exception.Message)" }
    Start-Sleep 5
  }
  Note "QA flag ($label): matched=$m after 60 s"; $false
}
# Flagged BEFORE anything installs or launches (#201's order, the lead): the route keeps a matched:false row and the
# app's later registration stays qa=true, so a hang or a cancel never leaves this install counted as real.
try {
  $pre = Invoke-WebRequest -Method Post -Uri 'https://api.unvibe.site/api/v1/admin/qa-install' -UseBasicParsing `
    -Headers @{ authorization = "Bearer $env:UNVIBE_QA_FLAG_TOKEN" } -ContentType 'application/json' `
    -Body (@{ installId = $env:INSTALL_ID } | ConvertTo-Json -Compress)
  Note "QA pre-flag before install: $($pre.StatusCode) matched=$(($pre.Content | ConvertFrom-Json).matched)"
} catch { $pre = $null; Note "QA pre-flag before install: $($_.Exception.Message)" }
if (-not $pre -or $pre.StatusCode -ne 200) { Note 'FAIL  QA pre-flag: not 200, so nothing is installed'; exit 1 }

$exe = $null
if ($Kind -eq 'ps1') {
  # The site's command, run as a person pastes it into Windows PowerShell; only the anonymous count goes nowhere.
  $live = (Invoke-WebRequest -Uri 'https://unvibe.site/install.ps1' -UseBasicParsing).Content
  Set-Content "$Out\install.ps1.live" $live -Encoding utf8
  $run = $live -replace '(?m)^\$track = .*$', '$track = "http://127.0.0.1:9/qa-no-count"'
  Set-Content "$Out\install.ps1.run" $run -Encoding utf8
  Note "install.ps1 sha256 $((Get-FileHash "$Out\install.ps1.live" -Algorithm SHA256).Hash); run copy changes only the `$track line: $((Compare-Object ($live -split "`n") ($run -split "`n") | ForEach-Object { $_.InputObject.Trim() }) -join ' => ')"
  $t0 = Get-Date
  $p = Start-Process powershell.exe -ArgumentList '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', "Get-Content -Raw '$Out\install.ps1.run' | Invoke-Expression" `
    -RedirectStandardOutput "$Out\install.log" -RedirectStandardError "$Out\install.err" -PassThru
  # Not Start-Process -Wait: that also waits for descendants, and install.ps1 ends by starting Unvibe, which keeps
  # running (run 42181832386's ps1 rows sat here until their time limit; unvibe-app's diagnosis).
  $null = $p.Handle # Windows PowerShell 5.1 reports no ExitCode unless the handle was read while the process ran
  if (-not $p.WaitForExit(600000)) { Note 'FAIL  install: install.ps1 still running after 10 min'; $p | Stop-Process -Force }
  Note "install.ps1 exit $($p.ExitCode) after $([int]((Get-Date) - $t0).TotalSeconds) s; output: $((Get-Content "$Out\install.log" -Tail 4) -join ' / ') $((Get-Content "$Out\install.err" -Tail 4) -join ' / ')"
  if ($p.ExitCode -ne 0) { Note "FAIL  install: install.ps1 exit $($p.ExitCode)" }
  $exe = Join-Path $env:LOCALAPPDATA 'Unvibe\Unvibe.exe'
  $z = Get-Content $exe -Stream Zone.Identifier -ErrorAction SilentlyContinue
  Note "installed exe: $(if (Test-Path $exe) { "$((Get-Item $exe).Length) bytes" } else { 'MISSING' }); Mark of the Web: $(if ($z) { $z -join ' ' } else { 'none (so SmartScreen does not ask)' })"
  Note "Start menu shortcut: $(Test-Path (Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Unvibe.lnk'))"
} elseif ($Kind -eq 'setup') {
  # What the new install.ps1 will do: the setup exe (no Mark of the Web: a script download has none), /S, launch.
  $setup = "$env:RUNNER_TEMP\Unvibe-$env:V-win-x64-setup.exe"
  Invoke-WebRequest -Uri "https://github.com/ShadowEsu/Unvibe/releases/download/v$env:V/Unvibe-$env:V-win-x64-setup.exe" -OutFile $setup -UseBasicParsing
  Note "setup.exe $((Get-Item $setup).Length) bytes, sha256 $((Get-FileHash $setup -Algorithm SHA256).Hash.ToLower()); Authenticode: $((Get-AuthenticodeSignature $setup).Status)"
  $t0 = Get-Date
  $p = Start-Process -FilePath $setup -ArgumentList '/S' -PassThru
  $null = $p.Handle
  if (-not $p.WaitForExit(600000)) { Note 'FAIL  install: setup.exe still running after 10 min' }
  Note "setup.exe /S exit $($p.ExitCode) after $([int]((Get-Date) - $t0).TotalSeconds) s"
  if ($p.ExitCode -ne 0) { Note "FAIL  install: setup.exe /S exit $($p.ExitCode)" }
  Start-Sleep 3
  $already = Get-Process | Where-Object { $_.ProcessName -like 'Unvibe*' }
  Note "app running after a silent install, before anything opens it: $([bool]$already)"
} else {
  # The site's ".exe" link, saved as a browser does (Internet zone), opened like a double-click.
  $asset = if ($Kind -eq 'setupexe') { "Unvibe-$env:V-win-x64-setup.exe" } else { "Unvibe-$env:V-win-x64-portable.exe" }
  $exe = "$env:USERPROFILE\Downloads\$asset"
  $u = "https://github.com/ShadowEsu/Unvibe/releases/download/v$env:V/$asset"
  Invoke-WebRequest -Uri $u -OutFile $exe -UseBasicParsing
  Set-Content -Path $exe -Stream Zone.Identifier -Value "[ZoneTransfer]`r`nZoneId=3`r`nReferrerUrl=https://unvibe.site/`r`nHostUrl=$u"
  $sig = Get-AuthenticodeSignature $exe
  Note "downloaded $asset ($((Get-Item $exe).Length) bytes), Mark of the Web ZoneId=3; Authenticode: $($sig.Status) $($sig.SignerCertificate.Subject)"
  Start-Process explorer.exe -ArgumentList "`"$exe`""
  Start-Sleep 12
  Shot 'smartscreen-1-double-click'
  Note "windows with titles after the double-click: $(Titled)"
  $more = Find 'More info'
  if ($more) {
    Note 'PROMPT SmartScreen: "Windows protected your PC" with More info'
    [void](Press $more); Start-Sleep 3
    Shot 'smartscreen-2-more-info'
    $runAnyway = Find 'Run anyway'
    Note "PROMPT SmartScreen after More info: Run anyway shown: $([bool]$runAnyway)"
    # The site's step: More info, then Run anyway.
    if ($runAnyway) { [void](Press $runAnyway); Note 'pressed Run anyway' }
  } else {
    Note 'no SmartScreen prompt on this runner (no "More info" on screen)'
  }
  if ($Kind -eq 'setupexe') {
    # The installer is assisted, not one-click (app/package.json nsis: oneClick false, directory choice allowed), so
    # a person clicks through its pages. Each page is pictured with its words, then its forward button is pressed.
    $TA = [System.Windows.Automation.TreeScope]; $AE = [System.Windows.Automation.AutomationElement]
    $isButton = New-Object System.Windows.Automation.PropertyCondition($AE::ControlTypeProperty, [System.Windows.Automation.ControlType]::Button)
    $isText = New-Object System.Windows.Automation.PropertyCondition($AE::ControlTypeProperty, [System.Windows.Automation.ControlType]::Text)
    $isCheck = New-Object System.Windows.Automation.PropertyCondition($AE::ControlTypeProperty, [System.Windows.Automation.ControlType]::CheckBox)
    $page = 0; $seen = $false
    for ($k = 0; $k -lt 60 -and $page -lt 12; $k++) {
      Start-Sleep 2
      # The setup process's own window, by handle (a name search from the UIA root missed it in run 42186807194).
      $sp = Get-Process | Where-Object { $_.ProcessName -like '*-setup' -and $_.MainWindowHandle -ne 0 } | Select-Object -First 1
      if (-not $sp) { if ($seen) { break } else { continue } }
      $sw = $AE::FromHandle($sp.MainWindowHandle)
      if (-not $seen) { Note "  installer window: '$($sp.MainWindowTitle)' handle $($sp.MainWindowHandle), UIA name '$($sw.Current.Name)'" }
      $seen = $true
      $all = @($sw.FindAll($TA::Descendants, $isButton))
      $btns = @($all | Where-Object { $_.Current.IsEnabled })
      if ($k -lt 3) { Note "  installer buttons seen: $(($all | ForEach-Object { "$($_.Current.Name)$(if (-not $_.Current.IsEnabled) { ' (off)' })" }) -join ', ')" }
      $fwd = $null
      foreach ($n in 'Finish', 'Install', 'Next >') { $fwd = $btns | Where-Object { $_.Current.Name -eq $n } | Select-Object -First 1; if ($fwd) { break } }
      if (-not $fwd) { continue } # the Installing… page: no forward button until it's done
      $page++
      $words = (@($sw.FindAll($TA::Descendants, $isText)) | ForEach-Object { $_.Current.Name } | Where-Object { $_ }) -join ' / '
      $checks = (@($sw.FindAll($TA::Descendants, $isCheck)) | ForEach-Object { "[$(if ($_.GetCurrentPattern([System.Windows.Automation.TogglePattern]::Pattern).Current.ToggleState -eq 'On') { 'x' } else { ' ' })] $($_.Current.Name)" }) -join ', '
      Shot ("installer-page-{0:d2}" -f $page)
      Note "PROMPT installer page ${page}: $words$(if ($checks) { " | $checks" }) | buttons: $(($btns | ForEach-Object { $_.Current.Name }) -join ', ') | pressing '$($fwd.Current.Name)'"
      [void](Press $fwd)
      Start-Sleep 2
    }
    Note "installer pages clicked through: $page"
  }
}
if ($isSetup) {
  $exe = $null
  for ($i = 0; $i -lt 30 -and -not $exe; $i++) {
    $exe = (Get-ChildItem "$env:LOCALAPPDATA\Programs", "$env:ProgramFiles" -Recurse -Filter 'Unvibe.exe' -ErrorAction SilentlyContinue | Select-Object -First 1).FullName
    if (-not $exe) { Start-Sleep 2 }
  }
  if (-not $exe) { Note 'FAIL  install: no installed Unvibe.exe' } else { Note "installed at $exe" }
  $links = StartMenuLinks
  if ($links) { Note "PASS  Start menu entry: $(($links | ForEach-Object { "$($_.FullName) -> $((New-Object -ComObject WScript.Shell).CreateShortcut($_.FullName).TargetPath)" }) -join ' | ')" } else { Note 'FAIL  Start menu entry: none' }
  $un = UninstallEntry
  if ($un) { Note "PASS  uninstall entry: '$($un.DisplayName)' $($un.DisplayVersion), publisher '$($un.Publisher)', UninstallString $($un.UninstallString)" } else { Note 'FAIL  uninstall entry: none in Apps & features' }
  Note "desktop shortcut: $(Test-Path (Join-Path ([Environment]::GetFolderPath('Desktop')) 'Unvibe.lnk'))"
  $running = Get-Process | Where-Object { $_.ProcessName -eq 'Unvibe' }
  if ($running) { Note 'the installer opened Unvibe itself (its last page)' }
  elseif ($exe) { Note 'opening the installed Unvibe (as install.ps1 will, or the Start menu entry)'; Start-Process -FilePath $exe }
}

# First launch: a window, still open 20 s later.
$win = $null
for ($i = 0; $i -lt 45 -and -not $win; $i++) {
  Start-Sleep 2
  $win = Get-Process | Where-Object { $_.ProcessName -eq 'Unvibe' -and $_.MainWindowHandle -ne 0 } | Select-Object -First 1
}
$front = Front
Shot 'first-launch'
if ($win) {
  $inFront = $front -like 'Unvibe: *'
  if ($isSetup) { Note "$(if ($inFront) { 'PASS' } else { 'FAIL' })  first window in front: the foreground window is '$front'" }
  else { Note "NOTE  first window in front: '$front'" }
}
Note "Unvibe processes: $((Get-Process | Where-Object { $_.ProcessName -like 'Unvibe*' } | ForEach-Object { "$($_.ProcessName)#$($_.Id)" }) -join ', ')"
Note "windows with titles: $(Titled)"
if ($win) {
  Start-Sleep 20
  $alive = [bool](Get-Process -Id $win.Id -ErrorAction SilentlyContinue)
  if ($alive) { Note "PASS  first launch: window '$($win.MainWindowTitle)' ($($win.Path)), still open 20 s later" } else { Note 'FAIL  first launch: the window closed within 20 s' }
} else { Note 'FAIL  first launch: no Unvibe window within 90 s' }
$stores = Get-ChildItem $env:APPDATA, $env:LOCALAPPDATA -Recurse -Filter 'unvibe-store.json' -ErrorAction SilentlyContinue | ForEach-Object { "$($_.FullName): $((Get-Content $_.FullName -Raw | ConvertFrom-Json).installId)" }
Note "store files: $($stores -join ' | ')"
if (-not (Flag 'first-contact')) { Note 'FAIL  QA flag right after first contact' }

# First explanation, on the same profile, through the app's debug port.
Get-Process | Where-Object { $_.ProcessName -like 'Unvibe*' } | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep 3
$env:UNVIBE_EXE = $exe; $env:USER_DATA = $storeDir; $env:OUT = $Out; $env:UNVIBE_OS = 'windows'; $env:NODE_PATH = "$env:RUNNER_TEMP\pw\node_modules"
$j = Start-Process node -ArgumentList "$env:RUNNER_TEMP\pw\first-explain.mjs" -RedirectStandardOutput "$Out\explain.log" -RedirectStandardError "$Out\explain.err" -PassThru
$null = $j.Handle
if (-not $j.WaitForExit(420000)) { $j | Stop-Process -Force; Note 'FAIL  first explanation: no result in 7 min' }
Note "first explanation (exit $($j.ExitCode)):"
if (Test-Path "$Out\explain-report.txt") { Get-Content "$Out\explain-report.txt" | ForEach-Object { Note "  $_" } }
Get-Process | Where-Object { $_.ProcessName -like 'Unvibe*' } | Stop-Process -Force -ErrorAction SilentlyContinue
if ($isSetup) {
  # Uninstall the way Settings › Apps does it, silently: the registered uninstaller with /S.
  $un = UninstallEntry
  if ($un) {
    $cmd = if ($un.QuietUninstallString) { $un.QuietUninstallString } else { "$($un.UninstallString) /S" }
    Note "uninstalling: $cmd"
    Start-Process cmd.exe -ArgumentList '/c', $cmd -WindowStyle Hidden
    # NSIS's uninstaller copies itself to Temp and exits at once, so the files tell when it's done.
    for ($i = 0; $i -lt 60 -and $exe -and (Test-Path $exe); $i++) { Start-Sleep 2 }
    Start-Sleep 3
    $gone = -not ($exe -and (Test-Path $exe)); $linksLeft = StartMenuLinks; $entryLeft = UninstallEntry
    $ok = $gone -and -not $linksLeft -and -not $entryLeft
    Note "$(if ($ok) { 'PASS' } else { 'FAIL' })  uninstall: app removed $gone, Start menu entry left $([bool]$linksLeft), Apps & features entry left $([bool]$entryLeft); app data left in $storeDir $(Test-Path $store)"
  } else { Note 'FAIL  uninstall: no uninstall entry to run' }
}
if (Select-String -Path "$Out\report.txt" -Pattern '^\s*FAIL' -Quiet) { exit 1 }
exit 0
