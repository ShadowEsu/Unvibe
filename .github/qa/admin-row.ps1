# The 0.1.52 RC's admin-window message (635b8d7d; support: 2 users) on Windows Server 2022 + 2025, with no hosted-AI
# call. Unvibe runs at medium integrity (started through Explorer, as from the Start menu); one PowerShell console runs
# as administrator, another one and Notepad at medium. Unvibe's copy keystroke is Ctrl+Insert, sent from its own
# powershell.exe (selection.ts PS_COPY); UIPI drops it at a higher-integrity window while SendKeys still reports success.
#   pre  UAC (EnableLUA) and the integrity level of this script, Explorer, Unvibe and each window's process. Unvibe not
#        below the admin console, or not equal to the normal windows, = NOT TESTABLE (nothing else runs).
#   (a)  admin console, text selected: the admin note, captureBlock() 'elevated', the text NOT captured, 1 keystroke.
#   (b1) normal console, nothing selected: the usual picker, no admin note, captureBlock() null, 1 keystroke (a console
#        gets no second keystroke).
#   (b2) normal Notepad, nothing selected: the usual picker, no admin note, null, 2 keystrokes (an editor gets a retry).
#   (c)  normal console, text selected: the panel holds the text, no admin note, null (the elevated block is cleared),
#        1 keystroke. This also proves the selection method (a) relies on.
#   (d)  admin console, nothing selected: the admin note again, 'elevated', 1 keystroke. By design (the app can't tell
#        "nothing selected" from "dropped" at an elevated window), so it is recorded as EXPECTED, not as a feature PASS;
#        any other outcome is a FAIL.
# captureBlock() is the app's own answer through the panel's IPC (widget-state.mjs); the keystrokes are the
# powershell.exe starts whose parent is Unvibe and whose command line sends keys (proc-watch.ps1).
# No AI (591): after the send agreement (consent-fixture.mjs, nothing sent), api.unvibe.site points at 127.0.0.1 and ::1
# in the hosts file (checked by a DNS lookup) and a firewall rule blocks Unvibe.exe's outbound traffic, before Unvibe
# starts again; (c)'s captured text starts a review that can't connect. Both are removed in a finally block, and again
# by the workflow's always() step.
# Usage: admin-row.ps1 -Out <dir>   Env: INSTALL_ID, RC_DIR (the build-only run's Windows artifact), RUNNER_TEMP (pw\
# holds playwright, consent-fixture.mjs and widget-state.mjs)
param([string]$Out)
$ErrorActionPreference = 'Continue'
New-Item -ItemType Directory -Force $Out | Out-Null
function Note($s) { [IO.File]::AppendAllText("$Out\report.txt", "$s`r`n", (New-Object Text.UTF8Encoding $false)); Write-Host $s }
function Verdict($ok, $what) { Note "$(if ($ok) { 'PASS' } else { 'FAIL' })  $what" }
Add-Type -AssemblyName System.Windows.Forms, System.Drawing
Add-Type @"
using System; using System.Text; using System.Runtime.InteropServices;
public static class A {
  public delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc f, IntPtr l);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr h, int c);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern void keybd_event(byte vk, byte scan, uint flags, IntPtr extra);
  [DllImport("kernel32.dll")] static extern IntPtr OpenProcess(uint access, bool inherit, uint pid);
  [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr h);
  [DllImport("advapi32.dll")] static extern bool OpenProcessToken(IntPtr p, uint access, out IntPtr t);
  [DllImport("advapi32.dll")] static extern bool GetTokenInformation(IntPtr t, int cls, IntPtr info, int len, out int ret);
  [DllImport("advapi32.dll")] static extern IntPtr GetSidSubAuthorityCount(IntPtr sid);
  [DllImport("advapi32.dll")] static extern IntPtr GetSidSubAuthority(IntPtr sid, uint i);
  public static string Title(IntPtr h) { var s = new StringBuilder(512); GetWindowText(h, s, 512); return s.ToString(); }
  // The first visible top-level window whose title contains `part` (an elevated console's title starts "Administrator: ").
  public static IntPtr Find(string part) {
    IntPtr found = IntPtr.Zero;
    EnumWindows((h, l) => { if (IsWindowVisible(h) && Title(h).Contains(part)) { found = h; return false; } return true; }, IntPtr.Zero);
    return found;
  }
  public static uint Owner(IntPtr h) { uint pid; GetWindowThreadProcessId(h, out pid); return pid; }
  // An Alt tap first, so Windows lets this process move the foreground (the tap goes to the window in front now).
  public static bool Front(IntPtr h) {
    keybd_event(0x12, 0, 0, IntPtr.Zero); keybd_event(0x12, 0, 2, IntPtr.Zero);
    ShowWindow(h, 9); SetForegroundWindow(h); System.Threading.Thread.Sleep(600);
    return GetForegroundWindow() == h;
  }
  // The process token's mandatory label RID (TokenIntegrityLevel = 25): 0x2000 medium, 0x3000 high; below 0: unreadable.
  public static int Integrity(uint pid) {
    IntPtr p = OpenProcess(0x1000, false, pid); if (p == IntPtr.Zero) return -1;
    try {
      IntPtr t; if (!OpenProcessToken(p, 0x8, out t)) return -2;
      try {
        int n; GetTokenInformation(t, 25, IntPtr.Zero, 0, out n); if (n <= 0) return -3;
        IntPtr b = Marshal.AllocHGlobal(n);
        try {
          if (!GetTokenInformation(t, 25, b, n, out n)) return -3;
          IntPtr sid = Marshal.ReadIntPtr(b);
          int count = Marshal.ReadByte(GetSidSubAuthorityCount(sid));
          return Marshal.ReadInt32(GetSidSubAuthority(sid, (uint)(count - 1)));
        } finally { Marshal.FreeHGlobal(b); }
      } finally { CloseHandle(t); }
    } finally { CloseHandle(p); }
  }
}
"@
$levels = @{ 4096 = 'low'; 8192 = 'medium'; 8448 = 'medium plus'; 12288 = 'high'; 16384 = 'system' }
function Level($procId) { $r = [A]::Integrity([uint32]$procId); if ($levels.ContainsKey($r)) { '{0} (0x{1:X})' -f $levels[$r], $r } else { "unreadable ($r)" } }
function Full($name) {
  $b = [System.Windows.Forms.SystemInformation]::VirtualScreen
  $bmp = New-Object System.Drawing.Bitmap $b.Width, $b.Height
  [System.Drawing.Graphics]::FromImage($bmp).CopyFromScreen($b.Left, $b.Top, 0, 0, $bmp.Size)
  $bmp.Save("$Out\$name.png"); $bmp.Dispose()
}
function Press() { # Ctrl+Alt+U, Windows' default shortcut (settings.ts DEFAULT_SHORTCUT)
  [A]::keybd_event(0x11, 0, 0, [IntPtr]::Zero); [A]::keybd_event(0x12, 0, 0, [IntPtr]::Zero); [A]::keybd_event(0x55, 0, 0, [IntPtr]::Zero)
  Start-Sleep -Milliseconds 60
  [A]::keybd_event(0x55, 0, 2, [IntPtr]::Zero); [A]::keybd_event(0x12, 0, 2, [IntPtr]::Zero); [A]::keybd_event(0x11, 0, 2, [IntPtr]::Zero)
}
function ClearClip() { try { [System.Windows.Forms.Clipboard]::Clear() } catch { Note "  clipboard clear: $($_.Exception.Message)" } }
function Clip() { try { [System.Windows.Forms.Clipboard]::GetText() } catch { '' } }
function Keys() { # Unvibe's copy keystrokes so far
  $log = "$Out\proc-watch.log"
  if (Test-Path $log) { @(Get-Content $log | Where-Object { $_ -match ' parent Unvibe#' -and $_ -match 'sendkeys=True' }).Count } else { 0 }
}
function Medium($name, $line) { # $line started by Explorer (medium integrity when UAC is on), as a Start-menu launch would be
  $cmd = Join-Path $Out "start-$name.cmd"
  [IO.File]::WriteAllText($cmd, "@echo off`r`nstart `"`" $line`r`n", (New-Object Text.ASCIIEncoding))
  Start-Process explorer.exe -ArgumentList "`"$cmd`""
}
function Window($part, $seconds) {
  $h = [IntPtr]::Zero
  for ($i = 0; $i -lt $seconds * 4 -and $h -eq [IntPtr]::Zero; $i++) { Start-Sleep -Milliseconds 250; $h = [A]::Find($part) }
  $h
}
$hosts = "$env:SystemRoot\System32\drivers\etc\hosts"
$tag = '# qa-admin-row'
$rule = 'qa-admin-row: Unvibe outbound'
function Unblock() {
  (Get-Content $hosts) | Where-Object { $_ -notmatch [regex]::Escape($tag) } | Set-Content $hosts -Encoding ascii
  Remove-NetFirewallRule -DisplayName $rule -ErrorAction SilentlyContinue
  ipconfig /flushdns | Out-Null
}

$os = Get-CimInstance Win32_OperatingSystem
Note "ROW admin-window on $($os.Caption) build $($os.BuildNumber)"
try {
  # --- Install the RC and give its profile the send agreement (nothing sent) -----------------------------------------
  $setup = (Get-ChildItem $env:RC_DIR -Recurse -Filter '*-win-x64-setup.exe' | Select-Object -First 1).FullName
  Note "RC setup: $(Split-Path $setup -Leaf), sha256 $((Get-FileHash $setup).Hash.ToLower())"
  $p = Start-Process $setup -ArgumentList '/S' -PassThru; $null = $p.Handle; [void]$p.WaitForExit(300000)
  $exe = Join-Path $env:LOCALAPPDATA 'Programs\Unvibe\Unvibe.exe'
  Note "setup /S exit $($p.ExitCode); $exe $(if (Test-Path $exe) { (Get-Item $exe).VersionInfo.ProductVersion } else { 'MISSING' })"
  if (-not (Test-Path $exe)) { Verdict $false 'the RC installs'; exit 1 }
  Get-Process Unvibe -ErrorAction SilentlyContinue | Stop-Process -Force; Start-Sleep 2
  $ud = Join-Path $env:APPDATA 'Unvibe'; New-Item -ItemType Directory -Force $ud | Out-Null
  [IO.File]::WriteAllText((Join-Path $ud 'unvibe-store.json'), "{`"installId`":`"$env:INSTALL_ID`"}", (New-Object Text.UTF8Encoding $false))
  $env:UNVIBE_EXE = $exe; $env:USER_DATA = $ud; $env:OUT = "$Out\fixture"; $env:UNVIBE_OS = 'windows'; $env:NODE_PATH = "$env:RUNNER_TEMP\pw\node_modules"
  $j = Start-Process node -ArgumentList "$env:RUNNER_TEMP\pw\consent-fixture.mjs" -RedirectStandardOutput "$Out\fixture.log" -RedirectStandardError "$Out\fixture.err" -PassThru; $null = $j.Handle
  if (-not $j.WaitForExit(240000)) { $j | Stop-Process -Force }
  Note "send agreement (consent-fixture.mjs, nothing sent; exit $($j.ExitCode)):"
  if (Test-Path "$Out\fixture\fixture-report.txt") { Get-Content "$Out\fixture\fixture-report.txt" | ForEach-Object { Note "  $_" } }
  Get-Process Unvibe -ErrorAction SilentlyContinue | Stop-Process -Force; Start-Sleep 3
  if (-not (Test-Path (Join-Path $ud 'unvibe-consent.json'))) { Verdict $false 'the profile holds the send agreement (unvibe-consent.json)'; exit 1 }
  # A returning person's profile: merged into what the app wrote, so its settingsRevision stays (a lower one resets onboarding).
  $sf = Join-Path $ud 'unvibe-settings.json'
  $s = if (Test-Path $sf) { Get-Content $sf -Raw | ConvertFrom-Json } else { [pscustomobject]@{} }
  foreach ($kv in ([ordered]@{ onboarded = $true; ownCodeExplained = $true }).GetEnumerator()) { $s | Add-Member -NotePropertyName $kv.Key -NotePropertyValue $kv.Value -Force }
  [IO.File]::WriteAllText($sf, ($s | ConvertTo-Json -Depth 20), (New-Object Text.UTF8Encoding $false))
  $stf = Join-Path $ud 'unvibe-store.json'
  $st = Get-Content $stf -Raw | ConvertFrom-Json
  $st | Add-Member -NotePropertyName loginPromptAsked -NotePropertyValue $true -Force
  [IO.File]::WriteAllText($stf, ($st | ConvertTo-Json -Depth 20), (New-Object Text.UTF8Encoding $false))
  Note "profile: onboarded, ownCodeExplained, loginPromptAsked; install id $($st.installId)"

  # --- No network for Unvibe from here on ------------------------------------------------------------------------------
  Add-Content -Path $hosts -Value "`r`n127.0.0.1 api.unvibe.site $tag`r`n::1 api.unvibe.site $tag" -Encoding ascii
  ipconfig /flushdns | Out-Null
  New-NetFirewallRule -DisplayName $rule -Direction Outbound -Program $exe -Action Block | Out-Null
  $addrs = @(try { [Net.Dns]::GetHostAddresses('api.unvibe.site') | ForEach-Object { $_.ToString() } } catch { })
  $loopback = $addrs.Count -gt 0 -and -not ($addrs | Where-Object { $_ -ne '127.0.0.1' -and $_ -ne '::1' })
  $fw = (Get-NetFirewallProfile | ForEach-Object { "$($_.Name) $(if ($_.Enabled) { 'on' } else { 'off' })" }) -join ', '
  Note "network: api.unvibe.site resolves to $($addrs -join ', '); firewall rule '$rule' $(if (Get-NetFirewallRule -DisplayName $rule -ErrorAction SilentlyContinue) { 'present' } else { 'MISSING' }); firewall profiles: $fw"
  Verdict $loopback 'api.unvibe.site resolves only to this machine before Unvibe starts again'
  if (-not $loopback) { exit 1 }

  # --- Windows, integrity levels ----------------------------------------------------------------------------------------
  $pol = Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System'
  Note "UAC: EnableLUA $($pol.EnableLUA), ConsentPromptBehaviorAdmin $($pol.ConsentPromptBehaviorAdmin), FilterAdministratorToken $($pol.FilterAdministratorToken); user $env:USERNAME"
  Note "integrity: this script $(Level $PID); Explorer $((Get-Process explorer -ErrorAction SilentlyContinue | ForEach-Object { "#$($_.Id) $(Level $_.Id)" }) -join ', ')"
  Start-Process powershell.exe -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSScriptRoot\proc-watch.ps1`" -Out `"$Out`" -Seconds 900" -WindowStyle Hidden
  for ($i = 0; $i -lt 40 -and -not (Test-Path "$Out\proc-watch.log"); $i++) { Start-Sleep -Milliseconds 250 }
  Start-Sleep 2
  Remove-Item (Join-Path $ud 'DevToolsActivePort') -ErrorAction SilentlyContinue
  Medium 'unvibe' "`"$exe`" --remote-debugging-port=0"
  for ($i = 0; $i -lt 120 -and -not (Test-Path (Join-Path $ud 'DevToolsActivePort')); $i++) { Start-Sleep -Milliseconds 250 }
  Start-Sleep 10 # the companion opens and settles
  $all = @(Get-CimInstance Win32_Process -Filter "Name='Unvibe.exe'")
  $main = $all | Where-Object { ($all.ProcessId) -notcontains $_.ParentProcessId } | Select-Object -First 1
  if (-not $main) { Verdict $false 'Unvibe starts through Explorer with its debug port'; exit 1 }
  $console = "$Out\console.ps1"
  [IO.File]::WriteAllText($console, "param([string]`$Title)`r`n`$Host.UI.RawUI.WindowTitle = `$Title`r`n", (New-Object Text.ASCIIEncoding))
  $consoleArgs = "powershell.exe -NoExit -NoProfile -ExecutionPolicy Bypass -File `"$console`" -Title"
  Start-Process conhost.exe -ArgumentList "$consoleArgs qa-admin-console" -Verb RunAs
  Medium 'console' "conhost.exe $consoleArgs qa-normal-console"
  Medium 'notepad' 'notepad.exe'
  $adminW = Window 'qa-admin-console' 30; $normalW = Window 'qa-normal-console' 30; $notepadW = Window 'Notepad' 30
  $who = { param($h) if ($h -eq [IntPtr]::Zero) { 'NOT FOUND' } else { $o = [A]::Owner($h); "'$([A]::Title($h))' process $((Get-Process -Id $o -ErrorAction SilentlyContinue).ProcessName)#$o $(Level $o)" } }
  Note "integrity: Unvibe main #$($main.ProcessId) $(Level $main.ProcessId)"
  Note "  admin console window: $(& $who $adminW)"
  Note "  normal console window: $(& $who $normalW)"
  Note "  Notepad window: $(& $who $notepadW)"
  foreach ($c in @(Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" | Where-Object { $_.CommandLine -match 'qa-(admin|normal)-console' })) { Note "  console shell powershell #$($c.ProcessId): $(Level $c.ProcessId) ($([regex]::Match($c.CommandLine, 'qa-\w+-console').Value))" }
  $u = [A]::Integrity([uint32]$main.ProcessId)
  $missing = @(@($adminW, $normalW, $notepadW) | Where-Object { $_ -eq [IntPtr]::Zero }).Count
  $aL = if ($adminW -ne [IntPtr]::Zero) { [A]::Integrity([A]::Owner($adminW)) } else { -9 }
  $nL = if ($normalW -ne [IntPtr]::Zero) { [A]::Integrity([A]::Owner($normalW)) } else { -9 }
  $pL = if ($notepadW -ne [IntPtr]::Zero) { [A]::Integrity([A]::Owner($notepadW)) } else { -9 }
  # The admin console's window process can refuse a medium-integrity query; this script runs high, so -1 here means gone.
  if ($missing -or $u -lt 0 -or $aL -le $u -or $nL -ne $u -or $pL -ne $u) {
    Note "RESULT NOT TESTABLE: Unvibe $u, admin console $aL, normal console $nL, Notepad $pL ($missing window(s) not found). The rows need Unvibe below the admin console and equal to the normal windows."
    Full 'not-testable'
    exit 0
  }
  Note "testable: Unvibe and the normal windows at $(Level $main.ProcessId), the admin console at $(Level ([A]::Owner($adminW)))"

  # --- The rows ---------------------------------------------------------------------------------------------------------
  $ws = "$env:RUNNER_TEMP\pw\widget-state.mjs"
  function Row($id, $what, $h, $marker, $expect) {
    Note "--- ($id) $what"
    $front = [A]::Front($h)
    if ($marker -eq $null) { [System.Windows.Forms.SendKeys]::SendWait('{ESC}{ESC}'); Start-Sleep -Milliseconds 300 }
    else {
      # Typed at the console's prompt (never run) or into Notepad, then selected with Ctrl+A. This script runs high, so
      # UIPI lets its own Ctrl+Insert through: that copy says the selection holds the text, then Ctrl+A selects it again.
      [System.Windows.Forms.SendKeys]::SendWait('{ESC}'); [System.Windows.Forms.SendKeys]::SendWait($marker); Start-Sleep -Milliseconds 300
      [System.Windows.Forms.SendKeys]::SendWait('^a'); Start-Sleep -Milliseconds 300
      ClearClip; [System.Windows.Forms.SendKeys]::SendWait('^{INSERT}'); Start-Sleep -Milliseconds 600
      $copied = Clip
      Note "  selection check (this script's own Ctrl+Insert): $(if ($copied -match $marker) { 'the selection holds the text' } else { "NOT the text; clipboard '$($copied.Substring(0, [Math]::Min(80, $copied.Length)))'" })"
      [System.Windows.Forms.SendKeys]::SendWait('^a'); Start-Sleep -Milliseconds 300
    }
    $front = $front -and ([A]::GetForegroundWindow() -eq $h)
    Note "  in front before the press: $front ($([A]::Title([A]::GetForegroundWindow())))"
    ClearClip
    $k0 = Keys
    Press
    $wsArgs = @($ws, $ud, '--expect', $expect, '--wait', '15000'); if ($marker) { $wsArgs += @('--marker', $marker) }
    $line = & node @wsArgs 2>&1 | Select-Object -Last 1
    Start-Sleep 3 # proc-watch polls every 100 ms; the app's PowerShell runs well under that
    $keys = (Keys) - $k0
    Full "row-$id"
    Note "  panel: $line"
    Note "  copy keystrokes Unvibe sent: $keys"
    $st = try { $line | ConvertFrom-Json } catch { $null }
    & node $ws $ud --close 2>&1 | Out-Null
    Start-Sleep 1
    [pscustomobject]@{ State = $st; Keys = $keys; Front = $front }
  }
  $rA = Row 'a' 'admin console, text selected' $adminW 'qaadminrow7731' 'admin'
  Verdict ($rA.Front -and $rA.State.adminNote -and $rA.State.captureBlock -eq 'elevated' -and -not $rA.State.marker -and $rA.Keys -eq 1) "(a) admin console with a selection: admin note $($rA.State.adminNote), captureBlock '$($rA.State.captureBlock)', text captured $($rA.State.marker), $($rA.Keys) keystroke(s) (want: note, 'elevated', not captured, 1)"
  $rB1 = Row 'b1' 'normal console, nothing selected' $normalW $null 'picker'
  Verdict ($rB1.Front -and $rB1.State.usualPicker -and -not $rB1.State.adminNote -and $null -eq $rB1.State.captureBlock -and $rB1.Keys -eq 1) "(b1) normal console, nothing selected: picker $($rB1.State.usualPicker), admin note $($rB1.State.adminNote), captureBlock '$($rB1.State.captureBlock)', $($rB1.Keys) keystroke(s) (want: picker, no note, null, 1)"
  $rB2 = Row 'b2' 'normal Notepad, nothing selected' $notepadW $null 'picker'
  Verdict ($rB2.Front -and $rB2.State.usualPicker -and -not $rB2.State.adminNote -and $null -eq $rB2.State.captureBlock -and $rB2.Keys -eq 2) "(b2) normal Notepad, nothing selected: picker $($rB2.State.usualPicker), admin note $($rB2.State.adminNote), captureBlock '$($rB2.State.captureBlock)', $($rB2.Keys) keystroke(s) (want: picker, no note, null, 2)"
  # (c) follows an elevated press directly, so the block it clears is a fresh one.
  $rD0 = Row 'c-pre' 'admin console, nothing selected (sets the block (c) must clear)' $adminW $null 'admin'
  Note "  (c-pre) captureBlock '$($rD0.State.captureBlock)', admin note $($rD0.State.adminNote)"
  $rC = Row 'c' 'normal console, text selected' $normalW 'qanormalrow7731' 'marker'
  Verdict ($rC.Front -and $rC.State.marker -and -not $rC.State.adminNote -and $null -eq $rC.State.captureBlock -and $rC.Keys -eq 1) "(c) normal console with a selection: text captured $($rC.State.marker), admin note $($rC.State.adminNote), captureBlock '$($rC.State.captureBlock)' after an elevated press, $($rC.Keys) keystroke(s) (want: captured, no note, null, 1)"
  $rD = Row 'd' 'admin console, nothing selected' $adminW $null 'admin'
  $asDesigned = $rD.Front -and $rD.State.adminNote -and $rD.State.captureBlock -eq 'elevated' -and $rD.Keys -eq 1
  Note "$(if ($asDesigned) { 'EXPECTED' } else { 'FAIL    ' })  (d) admin console, nothing selected: admin note $($rD.State.adminNote), captureBlock '$($rD.State.captureBlock)', $($rD.Keys) keystroke(s) (by design the same note as (a); recorded, not a pass of the feature)"
} finally {
  Get-Process Unvibe, notepad -ErrorAction SilentlyContinue | Stop-Process -Force
  Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" | Where-Object { $_.CommandLine -match 'qa-(admin|normal)-console|proc-watch\.ps1' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  Unblock
  Note "network restored: hosts lines tagged '$tag' left: $(@(Get-Content $hosts | Where-Object { $_ -match [regex]::Escape($tag) }).Count); firewall rule $(if (Get-NetFirewallRule -DisplayName $rule -ErrorAction SilentlyContinue) { 'STILL PRESENT' } else { 'removed' })"
}
if (Select-String -Path "$Out\report.txt" -Pattern '^\s*FAIL' -Quiet) { exit 1 }
exit 0
