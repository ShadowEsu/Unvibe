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
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint flags, int dx, int dy, uint data, IntPtr extra);
  [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X, Y; }
  [DllImport("user32.dll")] static extern IntPtr WindowFromPoint(POINT p);
  [DllImport("user32.dll")] static extern IntPtr GetAncestor(IntPtr h, uint flags);
  // The process that owns the top-level window under a screen point (what a click there would reach).
  public static uint PidAt(int x, int y) { POINT p; p.X = x; p.Y = y; uint pid; GetWindowThreadProcessId(GetAncestor(WindowFromPoint(p), 2), out pid); return pid; }
}
"@
function Front() { $h = [Fg]::GetForegroundWindow(); $fp = [uint32]0; [void][Fg]::GetWindowThreadProcessId($h, [ref]$fp); $q = Get-Process -Id $fp -ErrorAction SilentlyContinue; "$($q.ProcessName): $($q.MainWindowTitle)" }
# A person's click (lead, 0.1.52 RC): the pointer moves to the element's centre and the left button goes down and up
# $n times (2 = a double-click). Real input, unlike a UIA press: Windows lets the process that got the last input
# event bring windows to the front, so this decides whether the app's first window may take the front.
# Refuses when another window covers the spot, since the click would land there. Its notes go to the host, so the
# function returns only $true / $false.
function RealClick($el, [int]$n = 1) {
  $r = $el.Current.BoundingRectangle; $name = $el.Current.Name
  if ($r.IsEmpty -or $r.Width -le 0) { Note "  click '$name': no on-screen rectangle" | Write-Host; return $false }
  $x = [int]($r.Left + $r.Width / 2); $y = [int]($r.Top + $r.Height / 2)
  $at = [Fg]::PidAt($x, $y)
  if ($at -ne [uint32]$el.Current.ProcessId) { Note "  click '$name' at $x,$y refused: the window there is $((Get-Process -Id $at -ErrorAction SilentlyContinue).ProcessName)#$at, not $((Get-Process -Id $el.Current.ProcessId -ErrorAction SilentlyContinue).ProcessName)#$($el.Current.ProcessId)" | Write-Host; return $false }
  [void][Fg]::SetCursorPos($x, $y); Start-Sleep -Milliseconds 150
  for ($i = 0; $i -lt $n; $i++) { [Fg]::mouse_event(2, 0, 0, 0, [IntPtr]::Zero); [Fg]::mouse_event(4, 0, 0, 0, [IntPtr]::Zero); Start-Sleep -Milliseconds 90 }
  Note "  real click x$n on '$name' at $x,$y ($((Get-Process -Id $at -ErrorAction SilentlyContinue).ProcessName)#$at)" | Write-Host; return $true
}
# Reads win-front-watch.ps1's log and notes what a person would have seen, timed from the launch double-click ($t0, a
# UTC time of day): when Unvibe's window showed, what was in front then and later, and its taskbar button's state.
# FLASH is the taskbar's own event: Windows refused the window's bid for the front and flashed its button instead.
function FrontReport($log, $t0) {
  if (-not (Test-Path $log)) { Note 'FAIL  front watch: no front-watch.log'; return }
  $ev = @(Get-Content $log | ForEach-Object {
    if ($_ -match '^\s*\d+ (\d\d:\d\d:\d\d\.\d{3}) (\S+)\s+(.*)$') { [pscustomobject]@{ S = ([TimeSpan]::Parse($Matches[1]) - $t0).TotalSeconds; Kind = $Matches[2]; Text = $Matches[3] } }
  })
  $frontAt = { param($s) $f = $ev | Where-Object { $_.Kind -eq 'front' -and $_.S -le $s } | Select-Object -Last 1; if ($f) { $f.Text } else { '(not seen yet)' } }
  Note "front watch: $($ev.Count) events; $(($ev | Where-Object Kind -eq 'start').Text)"
  # The window a taskbar button belongs to: visible, not minimized, not cloaked, not owned, not a tool window.
  $main = $ev | Where-Object { $_.Kind -eq 'unvibe' -and $_.Text -match 'visible=True minimized=False cloaked=0 owned=False tool=False' } | Select-Object -First 1
  $flash = @($ev | Where-Object { $_.Kind -eq 'shell' -and $_.Text -match '^FLASH Unvibe#' })
  $inFront = $ev | Where-Object { $_.Kind -eq 'front' -and $_.Text -match '^Unvibe#' } | Select-Object -First 1
  if ($main) {
    Note ("FRONT  Unvibe window visible: yes, from {0:+0.0;-0.0} s after the double-click: {1}" -f $main.S, $main.Text)
    Note ("FRONT  in front when it showed: {0} | 3 s later: {1} | 10 s later: {2} | at the end: {3}" -f (& $frontAt $main.S), (& $frontAt ($main.S + 3)), (& $frontAt ($main.S + 10)), (& $frontAt 1e9))
  } else { Note 'FRONT  Unvibe window visible: NO (no visible, unminimized, uncloaked taskbar window in the watch)' }
  $states = @()
  if ($flash.Count) { $states += [pscustomobject]@{ S = $flash[0].S; T = ("flashing ({0} FLASH events, first {1:+0.0;-0.0} s)" -f $flash.Count, $flash[0].S) } }
  if ($inFront) { $states += [pscustomobject]@{ S = $inFront.S; T = ("active (Unvibe in front from {0:+0.0;-0.0} s)" -f $inFront.S) } }
  $taskbar = if ($states.Count) { ($states | Sort-Object S | ForEach-Object { $_.T }) -join ', then ' } else { 'normal (never in front, never flashed)' }
  Note "FRONT  taskbar button: $taskbar"
  # One yes/no setup step with its time (activation-metrics, 611): a stranger who never sees the window never explains.
  $reach = if ($main -and $inFront) { "YES, in front {0:+0.0;-0.0} s after the double-click" -f [Math]::Max($main.S, $inFront.S) } elseif ($main -and $flash.Count) { 'NO: only a flashing taskbar button' } elseif ($main) { 'NO: open behind other windows, no flash' } else { 'NO: no window' }
  Note "FRONT  setup step 'the first window reaches the person': $reach"
  Note 'FRONT  timeline (front changes and the taskbar events for Unvibe):'
  $ev | Where-Object { $_.Kind -eq 'front' -or ($_.Kind -eq 'shell' -and $_.Text -match ' Unvibe#') } | Select-Object -First 40 | ForEach-Object { Note ("  {0,7:+0.0;-0.0} s {1,-6} {2}" -f $_.S, $_.Kind, $_.Text) }
}
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
  # #212 (live since #275): install.ps1 runs the one-click per-user setup, which installs under Programs with an Apps
  # entry, so the setup checks (Start menu, Apps entry, first window in front, uninstall) apply to it as well.
  $viaSetup = Join-Path $env:LOCALAPPDATA 'Programs\Unvibe\Unvibe.exe'
  if (-not (Test-Path $exe) -and (Test-Path $viaSetup)) { $exe = $viaSetup; $isSetup = $true; Note 'install.ps1 installed through the per-user setup (#212)' }
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
  # DL_FILE (qa-first-open.yml): the file the site's own download button saved in a real browser on this runner.
  $asset = if ($env:DL_FILE) { Split-Path $env:DL_FILE -Leaf } elseif ($Kind -eq 'setupexe') { "Unvibe-$env:V-win-x64-setup.exe" } else { "Unvibe-$env:V-win-x64-portable.exe" }
  $exe = "$env:USERPROFILE\Downloads\$asset"
  $u = "https://github.com/ShadowEsu/Unvibe/releases/download/v$env:V/$asset"
  # An RC that isn't released yet: the same file from the build-only run's artifact (RC_DIR), then saved as above.
  if ($env:DL_FILE) { if ((Resolve-Path $env:DL_FILE).Path -ne $exe) { Copy-Item $env:DL_FILE $exe -Force } }
  elseif ($env:RC_DIR) { Copy-Item (Get-ChildItem $env:RC_DIR -Recurse -Filter $asset | Select-Object -First 1).FullName $exe }
  else { Invoke-WebRequest -Uri $u -OutFile $exe -UseBasicParsing }
  $motw = Get-Content $exe -Stream Zone.Identifier -ErrorAction SilentlyContinue
  if ($env:DL_FILE -and $motw) { $how = "the browser's own Mark of the Web: $($motw -join ' ')" }
  else {
    Set-Content -Path $exe -Stream Zone.Identifier -Value "[ZoneTransfer]`r`nZoneId=3`r`nReferrerUrl=https://unvibe.site/`r`nHostUrl=$u"
    $how = if ($env:DL_FILE) { 'Mark of the Web ZoneId=3 ADDED (the browser saved none)' } else { 'Mark of the Web ZoneId=3' }
  }
  $sig = Get-AuthenticodeSignature $exe
  Note "downloaded $asset ($((Get-Item $exe).Length) bytes), $how; Authenticode: $($sig.Status) $($sig.SignerCertificate.Subject)"
  # Opened as a person does (lead, 0.1.52 RC: who launches the app decides whether its first window may take the
  # front): every window minimized as on a fresh desktop, so the runner's own terminal covers nothing; the Downloads
  # folder opens with the file selected; one real click on the file, then a real double-click. Not Start-Process.
  # win-front-watch.ps1 logs the front window, every Unvibe window and the taskbar's events from just before that.
  $fw = Start-Process powershell.exe -ArgumentList '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "$PSScriptRoot\win-front-watch.ps1", '-Out', $Out, '-Seconds', '120' -PassThru -WindowStyle Hidden
  $null = $fw.Handle
  # The watcher compiles its C# first: wait until its log has the "start" line, so it sees everything from the click on.
  $fwLog = Join-Path $Out 'front-watch.log'
  for ($i = 0; $i -lt 60 -and -not (@(Get-Content $fwLog -ErrorAction SilentlyContinue) -match ' start '); $i++) { Start-Sleep -Milliseconds 500 }
  Note "front watch: $(if (Test-Path $fwLog) { "started after $($i * 0.5) s" } else { 'NOT started after 30 s (the summary below will say so)' })"
  (New-Object -ComObject Shell.Application).MinimizeAll(); Start-Sleep 2
  Start-Process explorer.exe -ArgumentList "/select,`"$exe`""
  $leaf = Split-Path $exe -Leaf; $base = [IO.Path]::GetFileNameWithoutExtension($leaf); $item = $null
  $isItem = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty, [System.Windows.Automation.ControlType]::ListItem)
  $isFolder = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ClassNameProperty, 'CabinetWClass')
  for ($i = 0; $i -lt 40 -and -not $item; $i++) {
    Start-Sleep -Milliseconds 500
    foreach ($w in @($root.FindAll([System.Windows.Automation.TreeScope]::Children, $isFolder))) {
      # Explorer hides known extensions by default, so the item may be named without ".exe".
      $item = @($w.FindAll([System.Windows.Automation.TreeScope]::Descendants, $isItem)) | Where-Object { $_.Current.Name -in $leaf, $base } | Select-Object -First 1
      if ($item) { break }
    }
  }
  Shot 'explorer-0-downloads'
  $launchUtc = (Get-Date).ToUniversalTime().TimeOfDay
  if ($item -and (RealClick $item 1)) {
    Start-Sleep -Milliseconds 700 # past the double-click time, so the next two clicks are a fresh double-click
    $launchUtc = (Get-Date).ToUniversalTime().TimeOfDay
    if (RealClick $item 2) { Note "opened by a real double-click on '$($item.Current.Name)' in Explorer (Downloads)" }
    else { Note 'FAIL  real Explorer double-click: the second click was refused (see above)' }
  } else {
    Note "FAIL  real Explorer double-click: $(if ($item) { 'the file could not be clicked (see above)' } else { "no '$leaf' item in an Explorer window within 20 s" }); opened with explorer.exe <file> instead so the row goes on"
    Start-Process explorer.exe -ArgumentList "`"$exe`""
  }
  Start-Sleep 12
  Shot 'smartscreen-1-double-click'
  Note "windows with titles after the double-click: $(Titled)"
  $more = Find 'More info'
  if ($more) {
    Note 'PROMPT SmartScreen: "Windows protected your PC" with More info'
    # Real clicks, as a person's: the SmartScreen window gets the last input event, as it would for them.
    if (-not (RealClick $more 1)) { [void](Press $more); Note '  More info: UIA press instead (no real click possible)' }
    Start-Sleep 3
    Shot 'smartscreen-2-more-info'
    $runAnyway = Find 'Run anyway'
    Note "PROMPT SmartScreen after More info: Run anyway shown: $([bool]$runAnyway)"
    # The site's step: More info, then Run anyway.
    if ($runAnyway) {
      if (RealClick $runAnyway 1) { Note 'clicked Run anyway (real click)' }
      else { [void](Press $runAnyway); Note 'pressed Run anyway (UIA press: no real click possible)' }
    }
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
if ($isSetup -and $exe -and (Test-Path $exe)) {
  $asar = Join-Path (Split-Path $exe) 'resources\app.asar'
  $a = if (Test-Path $asar) { (Get-FileHash $asar -Algorithm SHA256).Hash.ToLower() } else { 'MISSING' }
  Note "installed version $((Get-Item $exe).VersionInfo.ProductVersion); resources\app.asar sha256 $a"
  if ($env:WANT_ASAR) { Note "$(if ($a -eq $env:WANT_ASAR) { 'PASS' } else { 'FAIL' })  installed app.asar is the release's (want $($env:WANT_ASAR.Substring(0, 8))…)" }
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
# The double-click rows (exe, setupexe): what a person would have seen, from win-front-watch.ps1 (lead, 0.1.52 RC).
if ($fw) {
  if (-not $fw.WaitForExit(180000)) { $fw | Stop-Process -Force; Note 'front watch: still running after 3 min, stopped' }
  Note "front watch exit $($fw.ExitCode)"
  Shot 'front-watch-end'
  FrontReport (Join-Path $Out 'front-watch.log') $launchUtc
}
$stores = Get-ChildItem $env:APPDATA, $env:LOCALAPPDATA -Recurse -Filter 'unvibe-store.json' -ErrorAction SilentlyContinue | ForEach-Object { "$($_.FullName): $((Get-Content $_.FullName -Raw | ConvertFrom-Json).installId)" }
Note "store files: $($stores -join ' | ')"
if (-not (Flag 'first-contact')) { Note 'FAIL  QA flag right after first contact' }

# First explanation, on the same profile, through the app's debug port.
Get-Process | Where-Object { $_.ProcessName -like 'Unvibe*' } | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep 3
$env:UNVIBE_EXE = $exe; $env:USER_DATA = $storeDir; $env:OUT = $Out; $env:UNVIBE_OS = 'windows'; $env:NODE_PATH = "$env:RUNNER_TEMP\pw\node_modules"
# NO_EXPLAIN=1 (qa-first-open.yml while BOSS's AI pause is on): stop at first launch, no hosted-AI call.
if ($env:NO_EXPLAIN -eq '1') { Note 'NOTE  first explanation skipped (NO_EXPLAIN=1: no hosted-AI call in this run)' }
else {
# RC builds: the lead's notice rows (N-0..N-3) after the first explanation.
if ($env:RC_DIR) { $env:NOTICES = '1' }
$j = Start-Process node -ArgumentList "$env:RUNNER_TEMP\pw\first-explain.mjs" -RedirectStandardOutput "$Out\explain.log" -RedirectStandardError "$Out\explain.err" -PassThru
$null = $j.Handle
if (-not $j.WaitForExit(600000)) { $j | Stop-Process -Force; Note 'FAIL  first explanation (and the RC notice rows): no result in 10 min' }
Note "first explanation (exit $($j.ExitCode)):"
if (Test-Path "$Out\explain-report.txt") { Get-Content "$Out\explain-report.txt" | ForEach-Object { Note "  $_" } }
}
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
