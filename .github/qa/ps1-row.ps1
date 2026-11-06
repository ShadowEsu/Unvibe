# One row of qa-ps1-212.yml: #212's install.ps1 (per-user setup.exe /S /currentuser, then open the installed app),
# run as a person pastes it, in Windows PowerShell 5.1 or pwsh, on a clean Windows runner.
# Usage: ps1-row.ps1 -Kind fresh|portable|setup|allusers|tamper -Shell powershell|pwsh -Out <dir>   Env: INSTALL_ID
#   fresh     nothing installed before
#   portable  over today's prod install.ps1 (portable exe) with launch at login on and a send agreement (P-1)
#   setup     over v0.1.49 setup.exe /S (per-user): one Apps entry, the exe from the HKCU entry (P-4)
#   allusers  over v0.1.49 setup.exe /allusers /S: the warning, no admin step, the HKLM copy untouched (P-2, P-4)
#   tamper    the downloaded setup.exe has one byte more: must stop with "does not match", nothing installed (P-3)
# Each run copy of a script changes only its $track line (the anonymous count goes nowhere), and for tamper its $url.
param([string]$Kind, [string]$Shell, [string]$Out)
$ErrorActionPreference = 'Continue'
New-Item -ItemType Directory -Force $Out | Out-Null
function Note($s) { $s | Tee-Object -FilePath "$Out\report.txt" -Append }
function Verdict($ok, $what) { Note "$(if ($ok) { 'PASS' } else { 'FAIL' })  $what" }
Add-Type -AssemblyName System.Windows.Forms, System.Drawing
$shotN = 0
function Shot($name) {
  $script:shotN++
  $b = [System.Windows.Forms.SystemInformation]::VirtualScreen
  $bmp = New-Object System.Drawing.Bitmap $b.Width, $b.Height
  [System.Drawing.Graphics]::FromImage($bmp).CopyFromScreen($b.Left, $b.Top, 0, 0, $bmp.Size)
  $bmp.Save(("$Out\{0:d2}-$name.png" -f $script:shotN))
}
Add-Type @"
using System; using System.Runtime.InteropServices;
public static class Fg {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
}
"@
function Front() { $h = [Fg]::GetForegroundWindow(); $fp = [uint32]0; [void][Fg]::GetWindowThreadProcessId($h, [ref]$fp); $q = Get-Process -Id $fp -ErrorAction SilentlyContinue; "$($q.ProcessName): $($q.MainWindowTitle)" }

$GUID = 'f5687918-a052-548a-a713-e4a84dbef267'
$UNINST = 'Software\Microsoft\Windows\CurrentVersion\Uninstall'
$perUser = Join-Path $env:LOCALAPPDATA 'Programs\Unvibe\Unvibe.exe'
$portable = Join-Path $env:LOCALAPPDATA 'Unvibe\Unvibe.exe'
$storeDir = Join-Path $env:APPDATA 'Unvibe'
$store = Join-Path $storeDir 'unvibe-store.json'
$consent = Join-Path $storeDir 'unvibe-consent.json'
function Entries() {
  foreach ($h in 'HKCU', 'HKLM') {
    Get-ChildItem "${h}:\$UNINST" -ErrorAction SilentlyContinue | ForEach-Object { $p = Get-ItemProperty $_.PSPath; if ($p.DisplayName -like 'Unvibe*') { [pscustomobject]@{ Hive = $h; Key = $_.PSChildName; Name = $p.DisplayName; Version = $p.DisplayVersion; Icon = $p.DisplayIcon; Uninstall = $p.UninstallString; Quiet = $p.QuietUninstallString } } }
  }
}
function Exact($h) { Get-ItemProperty "${h}:\$UNINST\$GUID" -ErrorAction SilentlyContinue }
function Exes() { foreach ($f in $perUser, $portable, (Join-Path $env:LOCALAPPDATA 'Programs\unvibe-app\Unvibe.exe'), (Join-Path $env:ProgramFiles 'Unvibe\Unvibe.exe')) { if (Test-Path $f) { "$f ($((Get-Item $f).VersionInfo.ProductVersion))" } } }
function Links() {
  $dirs = (Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'), (Join-Path $env:ProgramData 'Microsoft\Windows\Start Menu\Programs'), [Environment]::GetFolderPath('Desktop'), (Join-Path $env:PUBLIC 'Desktop')
  Get-ChildItem $dirs -Recurse -Filter 'Unvibe*.lnk' -ErrorAction SilentlyContinue | ForEach-Object { "$($_.FullName) -> $((New-Object -ComObject WScript.Shell).CreateShortcut($_.FullName).TargetPath)" }
}
function RunItems() {
  $p = Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run' -ErrorAction SilentlyContinue
  if ($p) { $p.PSObject.Properties | Where-Object { $_.Name -notlike 'PS*' -and "$($_.Name) $($_.Value)" -like '*nvibe*' } | ForEach-Object { "$($_.Name) = $($_.Value)" } }
}
function Id() { try { (Get-Content $store -Raw | ConvertFrom-Json).installId } catch { 'none' } }
function ConsentHash() { if (Test-Path $consent) { (Get-FileHash $consent -Algorithm SHA256).Hash.ToLower() } else { 'none' } }
function Temps() { @(Get-ChildItem ([IO.Path]::GetTempPath()) -Directory -Filter 'unvibe-install-*' -ErrorAction SilentlyContinue).Count }
function Main() { Get-Process Unvibe -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1 }
function State($label) {
  Note "STATE $label"
  Note "  exes: $((@(Exes)) -join ' | ')"
  Note "  Apps entries: $((@(Entries) | ForEach-Object { "[$($_.Hive)] key '$($_.Key)' '$($_.Name)' $($_.Version) icon $($_.Icon)" }) -join ' | ')"
  Note "  shortcuts: $((@(Links)) -join ' | ')"
  Note "  login item (HKCU Run): $((@(RunItems)) -join ' | ')"
  Note "  install id $(Id); consent sha256 $(ConsentHash); Unvibe processes: $((@(Get-Process Unvibe -ErrorAction SilentlyContinue | ForEach-Object { $_.Path } | Sort-Object -Unique)) -join ', ')"
}
function OldSetup() {
  $f = "$env:RUNNER_TEMP\Unvibe-0.1.49-win-x64-setup.exe"
  if (-not (Test-Path $f)) { Invoke-WebRequest -Uri 'https://github.com/ShadowEsu/Unvibe/releases/download/v0.1.49/Unvibe-0.1.49-win-x64-setup.exe' -OutFile $f -UseBasicParsing }
  $f
}
function RunWait($file, $argList) { $p = Start-Process -FilePath $file -ArgumentList $argList -PassThru; $null = $p.Handle; [void]$p.WaitForExit(600000); $p.ExitCode }
function RunCopy($src, $name, $extra) {
  $text = Get-Content -Raw $src
  $run = $text -replace '(?m)^\$track = .*$', '$track = "http://127.0.0.1:9/qa-no-count"'
  if ($extra) { $run = & $extra $run }
  $dst = "$Out\$name"; Set-Content $dst $run -Encoding utf8
  Note "$name from $(Split-Path $src -Leaf) (sha256 $((Get-FileHash $src -Algorithm SHA256).Hash.ToLower().Substring(0, 16))…); run copy changes: $((Compare-Object ($text -split "`n") ($run -split "`n") | Where-Object SideIndicator -eq '=>' | ForEach-Object { $_.InputObject.Trim() }) -join ' ; ')"
  $dst
}
# As a person pastes `irm … | iex`: the script text is run by Invoke-Expression in the chosen shell. Pictures of the
# whole screen every 3 s show any prompt (admin, SmartScreen) that comes up while it runs.
function Install($file, $label) {
  $exe = if ($Shell -eq 'pwsh') { 'pwsh.exe' } else { 'powershell.exe' }
  $argList = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', "Write-Output (`"QA shell: PowerShell `" + `$PSVersionTable.PSVersion + `" `" + `$PSVersionTable.PSEdition); Get-Content -Raw '$file' | Invoke-Expression")
  $t0 = Get-Date
  $p = Start-Process $exe -ArgumentList $argList -RedirectStandardOutput "$Out\$label.out" -RedirectStandardError "$Out\$label.err" -PassThru
  $null = $p.Handle
  $n = 0
  while (-not $p.HasExited -and ((Get-Date) - $t0).TotalSeconds -lt 600) { if ($n -lt 25) { Shot "$label-$([int]((Get-Date) - $t0).TotalSeconds)s"; $n++ }; Start-Sleep 3 }
  if (-not $p.HasExited) { Note "FAIL  $label still running after 10 min"; $p | Stop-Process -Force }
  $out = (Get-Content "$Out\$label.out", "$Out\$label.err" -ErrorAction SilentlyContinue) -join "`n"
  Note "$label in $exe ($((($out -split "`n") | Where-Object { $_ -like 'QA shell:*' } | Select-Object -First 1))) exit $($p.ExitCode) after $([int]((Get-Date) - $t0).TotalSeconds) s; output:"
  ($out -split "`n" | Where-Object { $_.Trim() } | Select-Object -Last 14) | ForEach-Object { Note "    | $_" }
  [pscustomobject]@{ Code = $p.ExitCode; Text = $out }
}

$os = Get-CimInstance Win32_OperatingSystem
$lua = (Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System' -ErrorAction SilentlyContinue).EnableLUA
Note "ROW ps1-212 $Kind in $Shell on $($os.Caption) build $($os.BuildNumber); runner user admin: $(([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)); UAC EnableLUA=$lua"
New-Item -ItemType Directory -Force $storeDir | Out-Null
Set-Content -Path $store -Value "{`"installId`":`"$env:INSTALL_ID`"}" -Encoding ascii -NoNewline
$new = RunCopy "$PSScriptRoot\install-212-ed91d6e2.ps1" 'install-212.run.ps1' $null
State 'clean runner'

if ($Kind -eq 'tamper') {
  $dir = "$env:RUNNER_TEMP\tamper"; New-Item -ItemType Directory -Force $dir | Out-Null
  Copy-Item (OldSetup) "$dir\Unvibe-0.1.49-win-x64-setup.exe"
  $fs = [IO.File]::Open("$dir\Unvibe-0.1.49-win-x64-setup.exe", 'Append'); $fs.WriteByte(0); $fs.Close()
  Note "tampered copy: $((Get-Item "$dir\Unvibe-0.1.49-win-x64-setup.exe").Length) bytes (one more), sha256 $((Get-FileHash "$dir\Unvibe-0.1.49-win-x64-setup.exe").Hash.ToLower())"
  $srv = Start-Process python -ArgumentList '-m', 'http.server', '47191', '--bind', '127.0.0.1', '--directory', $dir -PassThru -WindowStyle Hidden
  Start-Sleep 3
  $tam = RunCopy "$PSScriptRoot\install-212-ed91d6e2.ps1" 'install-212-tamper.run.ps1' { param($t) $t -replace '(?m)^\$url = .*$', '$url = "http://127.0.0.1:47191/$asset"' }
  $r = Install $tam 'install-tamper'
  $srv | Stop-Process -Force -ErrorAction SilentlyContinue
  Start-Sleep 3
  State 'after the tampered download'
  Verdict ($r.Code -ne 0) "P-3 the script stops (exit $($r.Code))"
  Verdict ($r.Text -match 'does not match the published checksum') 'P-3 the message says the download does not match the published checksum'
  Verdict (@(Exes).Count -eq 0 -and @(Entries).Count -eq 0 -and -not (Get-Process Unvibe -ErrorAction SilentlyContinue)) 'P-3 nothing installed, nothing started'
  Verdict ((Temps) -eq 0) "the script's temp folder is gone ($(Temps) left)"
  if (Select-String -Path "$Out\report.txt" -Pattern '^\s*FAIL' -Quiet) { exit 1 }
  exit 0
}

$before = $null
switch ($Kind) {
  'portable' {
    $prod = RunCopy "$PSScriptRoot\install-prod-39633d79.ps1" 'install-prod.run.ps1' $null
    [void](Install $prod 'install-prod')
    Start-Sleep 5; Get-Process Unvibe -ErrorAction SilentlyContinue | Stop-Process -Force; Start-Sleep 2
    # A real first use on the portable copy: onboarding, an explanation, a follow-up so the send agreement is made.
    $env:UNVIBE_EXE = $portable; $env:USER_DATA = $storeDir; $env:OUT = "$Out\portable"; $env:UNVIBE_OS = 'windows'; $env:NODE_PATH = "$env:RUNNER_TEMP\pw\node_modules"; $env:AGREE = '1'
    $j = Start-Process node -ArgumentList "$env:RUNNER_TEMP\pw\first-explain.mjs" -RedirectStandardOutput "$Out\portable-explain.log" -RedirectStandardError "$Out\portable-explain.err" -PassThru; $null = $j.Handle
    if (-not $j.WaitForExit(420000)) { $j | Stop-Process -Force }
    Remove-Item Env:AGREE
    Get-Content "$Out\portable\explain-report.txt" -ErrorAction SilentlyContinue | ForEach-Object { Note "  portable run: $_" }
    Get-Process Unvibe -ErrorAction SilentlyContinue | Stop-Process -Force; Start-Sleep 2
    # Launch at login on (as after "Yes" on the app's question), then one start so the app registers its login item.
    $sf = Join-Path $storeDir 'unvibe-settings.json'
    $s = try { Get-Content $sf -Raw | ConvertFrom-Json } catch { New-Object psobject }
    $s | Add-Member -NotePropertyName launchAtLogin -NotePropertyValue $true -Force
    Set-Content $sf ($s | ConvertTo-Json -Depth 20) -Encoding utf8
    Start-Process $portable; Start-Sleep 20; Get-Process Unvibe -ErrorAction SilentlyContinue | Stop-Process -Force; Start-Sleep 2
  }
  'setup' { Note "v0.1.49 setup /S exit $(RunWait (OldSetup) '/S')" }
  'allusers' { Note "v0.1.49 setup /allusers /S exit $(RunWait (OldSetup) '/allusers /S')" }
}
State 'before #212'
$before = [pscustomobject]@{ Id = Id; Consent = ConsentHash; Run = (@(RunItems)) -join ' | '; Links = @(Links)
  Hklm = (Exact 'HKLM' | Select-Object DisplayVersion, DisplayIcon, UninstallString | ConvertTo-Json -Compress)
  PfHash = if (Test-Path "$env:ProgramFiles\Unvibe\Unvibe.exe") { (Get-FileHash "$env:ProgramFiles\Unvibe\Unvibe.exe").Hash } else { 'none' } }
if ($Kind -eq 'portable') {
  Verdict ($before.Run -like "*$portable*") "P-1 setup: the login item points at the portable copy before ($($before.Run))"
  Verdict ($before.Consent -ne 'none') 'P-1 setup: a send agreement exists before'
}

$r = Install $new 'install-212'
$win = $null
for ($i = 0; $i -lt 30 -and -not $win; $i++) { Start-Sleep 2; $win = Main }
Start-Sleep 15 # the installed app's first start points an existing login item at itself
Shot 'after-install-212'
State 'after #212'
Verdict ($r.Code -eq 0) "install.ps1 exit $($r.Code)"
Verdict (Test-Path $perUser) "installed at $perUser"
$hkcu = Exact 'HKCU'
Verdict ([bool]$hkcu) "P-4 HKCU\$UNINST\$GUID exists (keys present: $((@(Entries) | ForEach-Object { "$($_.Hive)\$($_.Key)" }) -join ', '))"
$icon = if ($hkcu) { (($hkcu.DisplayIcon -split ',')[0]).Trim('"') } else { '' }
Verdict ($win -and $icon -and ($win.Path -eq $icon)) "P-4 the opened app is the exe the HKCU entry names (opened: $($win.Path); entry DisplayIcon: $icon)"
Verdict (@(Entries | Where-Object Hive -eq 'HKCU').Count -eq 1) "exactly one per-user Apps entry ($(@(Entries | Where-Object Hive -eq 'HKCU').Count))"
Verdict (@(Links | Where-Object { $_ -like '*Start Menu*' -and $_ -like "*-> $perUser" }).Count -ge 1) 'Start menu shortcut points at the installed exe'
Verdict (@(Links | Where-Object { $_ -like '*Desktop*' -and $_ -like "*-> $perUser" }).Count -ge 1) 'desktop shortcut points at the installed exe'
Verdict ((Temps) -eq 0) "the script's temp folder is gone ($(Temps) left)"
if ($win) { $front = Front; Verdict ($front -like 'Unvibe: *') "the opened app's window is in front ('$front')" } else { Note 'FAIL  no Unvibe window within 60 s' }
Verdict ((Id) -eq $env:INSTALL_ID) "install id kept ($(Id))"
switch ($Kind) {
  'portable' {
    Verdict (-not (Test-Path $portable) -and -not (Test-Path "$portable.download") -and -not (Test-Path "$portable.old")) 'P-1 the portable copy is gone (Unvibe.exe, .download, .old)'
    $run = (@(RunItems)) -join ' | '
    Verdict ($run -like "*$perUser*" -and $run -notlike "*$portable*") "P-1 the login item now points at the installed exe ($run)"
    Verdict ((ConsentHash) -eq $before.Consent) "P-1 send agreement unchanged (sha256 before $($before.Consent), after $(ConsentHash))"
    Note "NOTE  P-1 shortcuts before: $($before.Links -join ' | ')"
  }
  'allusers' {
    Verdict ($r.Text -match 'installed for all users is also on this PC') 'P-4/P-2 the all-users warning is shown'
    $now = Exact 'HKLM' | Select-Object DisplayVersion, DisplayIcon, UninstallString | ConvertTo-Json -Compress
    $pf = if (Test-Path "$env:ProgramFiles\Unvibe\Unvibe.exe") { (Get-FileHash "$env:ProgramFiles\Unvibe\Unvibe.exe").Hash } else { 'none' }
    Verdict ($before.Hklm -and $now -eq $before.Hklm -and $pf -eq $before.PfHash -and $pf -ne 'none') "P-2 the all-users copy is untouched (HKLM entry $now; Program Files exe sha256 same: $($pf -eq $before.PfHash))"
    Verdict ($win -and $win.Path -eq $perUser) "P-2 the per-user copy is the one opened ($($win.Path))"
    Note "NOTE  P-2 no admin prompt: runner UAC EnableLUA=$lua; the pictures every 3 s while the script ran show what came up"
  }
}

# First explanation with the installed copy, on the same profile.
Get-Process Unvibe -ErrorAction SilentlyContinue | Stop-Process -Force; Start-Sleep 3
$env:UNVIBE_EXE = $perUser; $env:USER_DATA = $storeDir; $env:OUT = $Out; $env:UNVIBE_OS = 'windows'; $env:NODE_PATH = "$env:RUNNER_TEMP\pw\node_modules"
$j = Start-Process node -ArgumentList "$env:RUNNER_TEMP\pw\first-explain.mjs" -RedirectStandardOutput "$Out\explain.log" -RedirectStandardError "$Out\explain.err" -PassThru; $null = $j.Handle
if (-not $j.WaitForExit(420000)) { $j | Stop-Process -Force; Note 'FAIL  first explanation: no result in 7 min' }
Get-Content "$Out\explain-report.txt" -ErrorAction SilentlyContinue | ForEach-Object { Note "  $_" }
Get-Process Unvibe -ErrorAction SilentlyContinue | Stop-Process -Force

foreach ($e in @(Entries)) {
  $cmd = if ($e.Quiet) { $e.Quiet } else { "$($e.Uninstall) /S" }
  Note "uninstalling [$($e.Hive)] '$($e.Name)': $cmd"
  Start-Process cmd.exe -ArgumentList '/c', $cmd -WindowStyle Hidden
  for ($i = 0; $i -lt 30 -and (@(Entries) | Where-Object { $_.Key -eq $e.Key -and $_.Hive -eq $e.Hive }); $i++) { Start-Sleep 2 }
}
Start-Sleep 5
State 'after uninstall'
Verdict ((@(Exes | Where-Object { $_ -notlike "$portable*" }).Count + @(Entries).Count + @(Links).Count) -eq 0) 'uninstall: app, Apps entries and shortcuts gone'
Note "NOTE  after uninstall $storeDir exists: $(Test-Path $storeDir); install id $(Id); consent $(ConsentHash)"
if (Select-String -Path "$Out\report.txt" -Pattern '^\s*FAIL' -Quiet) { exit 1 }
exit 0
