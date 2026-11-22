# QA (qa-mac-update.yml's windows job, "[win-update]"): the released FROM setup on a clean Windows runner updates
# itself to the published TO the way a user's install does: the app's own update check (GitHub releases API, drafts
# skipped) must offer TO's setup.exe, and its own install (download, SHA256SUMS-windows.txt check, the app quits and
# runs the setup silently into the same folder with --force-run) must leave TO installed in place and running, its
# app.asar = WANT_ASAR, Apps & features at TO, the profile (install id) kept. No hosted-AI call.
# Usage: win-update.ps1 -Out <dir>   Env: FROM, TO, WANT_ASAR, INSTALL_ID (qa-...), UNVIBE_QA_FLAG_TOKEN, RUNNER_TEMP
param([string]$Out)
$ErrorActionPreference = 'Continue'
New-Item -ItemType Directory -Force $Out | Out-Null
function Note($s) { $s | Tee-Object -FilePath "$Out\report.txt" -Append }
Add-Type -AssemblyName System.Windows.Forms, System.Drawing
function Shot($name) {
  $b = [System.Windows.Forms.SystemInformation]::VirtualScreen
  $bmp = New-Object System.Drawing.Bitmap $b.Width, $b.Height
  [System.Drawing.Graphics]::FromImage($bmp).CopyFromScreen($b.Left, $b.Top, 0, 0, $bmp.Size)
  $bmp.Save("$Out\$name.png")
}
function UninstallEntry() {
  Get-ChildItem 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall', 'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall', 'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall' -ErrorAction SilentlyContinue |
    ForEach-Object { Get-ItemProperty $_.PSPath } | Where-Object { $_.DisplayName -like 'Unvibe*' }
}
function Flag($label) {
  for ($i = 0; $i -lt 12; $i++) {
    try {
      $r = Invoke-WebRequest -Method Post -Uri 'https://api.unvibe.site/api/v1/admin/qa-install' -UseBasicParsing `
        -Headers @{ authorization = "Bearer $env:UNVIBE_QA_FLAG_TOKEN" } -ContentType 'application/json' `
        -Body (@{ installId = $env:INSTALL_ID } | ConvertTo-Json -Compress)
      $m = ($r.Content | ConvertFrom-Json).matched
      if ($label -eq 'pre') { Note "QA pre-flag: $($r.StatusCode) matched=$m"; return ($r.StatusCode -eq 200) }
      if ($r.StatusCode -eq 200 -and $m) { Note "QA flag ($label): 200 matched=true"; return $true }
    } catch { $m = "error $($_.Exception.Message)"; if ($label -eq 'pre') { Note "QA pre-flag: $m"; return $false } }
    Start-Sleep 5
  }
  Note "QA flag ($label): matched=$m after 60 s"; $false
}
$os = Get-CimInstance Win32_OperatingSystem
Note "WINDOWS UPDATE $env:FROM -> $env:TO on $($os.Caption) $($os.Version)"

# 1 The released FROM setup, checked against its release's checksum, installed per user as install.ps1 does (/S).
$name = "Unvibe-$env:FROM-win-x64-setup.exe"
$setup = Join-Path $env:USERPROFILE "Downloads\$name"
New-Item -ItemType Directory -Force (Split-Path $setup) | Out-Null
Invoke-WebRequest -Uri "https://github.com/ShadowEsu/Unvibe/releases/download/v$env:FROM/$name" -OutFile $setup -UseBasicParsing
Invoke-WebRequest -Uri "https://github.com/ShadowEsu/Unvibe/releases/download/v$env:FROM/SHA256SUMS-windows.txt" -OutFile "$Out\SHA256SUMS-windows-$env:FROM.txt" -UseBasicParsing
$want = (Get-Content "$Out\SHA256SUMS-windows-$env:FROM.txt" | Where-Object { ($_ -split '\s+')[-1] -eq $name } | ForEach-Object { ($_ -split '\s+')[0].ToLower() }) | Select-Object -First 1
$got = (Get-FileHash $setup -Algorithm SHA256).Hash.ToLower()
Note "$env:FROM setup sha256 $got; its SHA256SUMS-windows.txt $want; $(if ($got -eq $want) { 'match' } else { 'MISMATCH' })"
if (-not $want -or $got -ne $want) { Note "FAIL  the $env:FROM setup doesn't match its release checksum"; exit 1 }

# A set-up profile (onboarded) with a qa- install id, flagged before anything installs or launches.
$ud = Join-Path $env:APPDATA 'Unvibe'
Remove-Item -Recurse -Force $ud -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force $ud | Out-Null
Set-Content -Path (Join-Path $ud 'unvibe-store.json') -Value "{`"installId`":`"$env:INSTALL_ID`"}" -Encoding ascii -NoNewline
Set-Content -Path (Join-Path $ud 'unvibe-settings.json') -Value '{"onboarded":true,"theme":"light"}' -Encoding ascii -NoNewline
if (-not (Flag 'pre')) { Note 'FAIL  QA pre-flag: not 200, so nothing is installed'; exit 1 }

$t0 = Get-Date
$p = Start-Process -FilePath $setup -ArgumentList '/S' -PassThru
$null = $p.Handle
if (-not $p.WaitForExit(600000)) { Note "FAIL  the $env:FROM setup still running after 10 min"; exit 1 }
Note "$env:FROM setup /S exit $($p.ExitCode) after $([int]((Get-Date) - $t0).TotalSeconds) s"
Start-Sleep 3
Get-Process | Where-Object { $_.ProcessName -eq 'Unvibe' } | Stop-Process -Force -ErrorAction SilentlyContinue
$exe = Join-Path $env:LOCALAPPDATA 'Programs\Unvibe\Unvibe.exe'
if (-not (Test-Path $exe)) { $exe = (Get-ChildItem "$env:LOCALAPPDATA\Programs" -Recurse -Filter 'Unvibe.exe' -ErrorAction SilentlyContinue | Select-Object -First 1).FullName }
if (-not $exe) { Note 'FAIL  no installed Unvibe.exe'; exit 1 }
$ver = { ((Get-Item $exe).VersionInfo.ProductVersion -replace '\.0$', '') }
$un = UninstallEntry
Note "installed $(& $ver) at $exe; Apps & features: '$($un.DisplayName)' $($un.DisplayVersion)"
if ((& $ver) -ne $env:FROM) { Note "FAIL  installed version is $(& $ver), not $env:FROM"; exit 1 }

# The app's update check is GitHub's unauthenticated API (60 an hour per IP; a runner shares its IP). The run needs
# about 3 calls, so with fewer than 6 left it waits for the reset (at most 30 min) before the app starts.
function RateLimit() { try { (Invoke-RestMethod -Uri 'https://api.github.com/rate_limit' -TimeoutSec 15).resources.core } catch { $null } }
$rl = RateLimit
if ($rl) { Note "GitHub API from this runner (unauthenticated): $($rl.remaining) calls left this hour, reset $([DateTimeOffset]::FromUnixTimeSeconds($rl.reset).UtcDateTime.ToString('HH:mm:ssZ'))" }
if ($rl -and $rl.remaining -lt 6) {
  $wait = [Math]::Min(1800, $rl.reset - [DateTimeOffset]::UtcNow.ToUnixTimeSeconds() + 5)
  Note "NOTE  waiting $wait s for the runner's GitHub API reset"
  if ($wait -gt 0) { Start-Sleep -Seconds $wait }
  $rl = RateLimit; Note "GitHub API now: $($rl.remaining) calls left"
}

# 2 FROM opened with the debug port (the update path is the app's own, pressed through it).
Start-Process -FilePath $exe -ArgumentList '--remote-debugging-port=9229'
Start-Sleep 10
if (-not (Flag 'first-contact')) { Note 'FAIL  QA flag after first contact' }

# 3 The app's own check, then its own install (mac-update.mjs, given the Windows setup's name).
Copy-Item "$PSScriptRoot\mac-update.mjs" "$env:RUNNER_TEMP\pw\" -Force
$t1 = Get-Date
$n = Start-Process node -ArgumentList "$env:RUNNER_TEMP\pw\mac-update.mjs", $Out, $env:TO, 'x64', "Unvibe-$env:TO-win-x64-setup.exe" `
  -RedirectStandardOutput "$Out\win-update.log" -RedirectStandardError "$Out\win-update.err" -PassThru -WindowStyle Hidden
$null = $n.Handle
if (-not $n.WaitForExit(900000)) { Stop-Process -Id $n.Id -Force -ErrorAction SilentlyContinue; Note 'FAIL  the update check and install did not answer in 15 min' }
Get-Content "$Out\win-update.log", "$Out\win-update.err" -ErrorAction SilentlyContinue | ForEach-Object { Note $_ }
if (-not (Select-String -Path "$Out\win-update.log" -Pattern '^PASS  update offered' -Quiet)) { Note "FAIL  $env:FROM did not offer $env:TO (see above)"; exit 1 }

# 4 The swap: TO in the same folder and running from there, within 4 minutes of the install press.
$ok = $false
for ($i = 0; $i -lt 240; $i++) {
  $run = Get-Process -Name Unvibe -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $exe }
  if ((Test-Path $exe) -and (& $ver) -eq $env:TO -and $run) { $ok = $true; break }
  Start-Sleep 1
}
Note "$(if ($ok) { 'PASS' } else { 'FAIL' })  $exe is $(& $ver) and running, $([int]((Get-Date) - $t1).TotalSeconds) s after the install press"
Start-Sleep 8
Shot '3-after-update-full-screen'
Start-Sleep 12
$run = Get-Process -Name Unvibe -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $exe }
Note "$(if ($run) { 'PASS' } else { 'FAIL' })  the updated app is still running 20 s later"
$win = Get-Process -Name Unvibe -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
Note "$(if ($win) { 'PASS' } else { 'FAIL' })  an Unvibe window is on screen ($(if ($win) { "'$($win.MainWindowTitle)'" } else { 'none' }))"

# 5 What the update left behind.
$asar = Join-Path (Split-Path $exe) 'resources\app.asar'
$a = if (Test-Path $asar) { (Get-FileHash $asar -Algorithm SHA256).Hash.ToLower() } else { 'MISSING' }
Note "$(if ($a -eq $env:WANT_ASAR) { 'PASS' } else { 'FAIL' })  installed resources\app.asar sha256 $a (want $($env:WANT_ASAR.Substring(0, 8))...)"
$un = @(UninstallEntry)
Note "$(if ($un.Count -eq 1 -and $un[0].DisplayVersion -eq $env:TO) { 'PASS' } else { 'FAIL' })  Apps & features: $($un.Count) Unvibe entr$(if ($un.Count -eq 1) { 'y' } else { 'ies' }): $(($un | ForEach-Object { "'$($_.DisplayName)' $($_.DisplayVersion)" }) -join ', ')"
$copies = @(Get-ChildItem "$env:LOCALAPPDATA\Programs", "$env:ProgramFiles" -Recurse -Filter 'Unvibe.exe' -ErrorAction SilentlyContinue | ForEach-Object { $_.FullName })
Note "$(if ($copies.Count -eq 1) { 'PASS' } else { 'FAIL' })  one installed Unvibe.exe: $($copies -join ', ')"
$store = Join-Path $ud 'unvibe-store.json'
$id = if (Test-Path $store) { (Get-Content $store -Raw | ConvertFrom-Json).installId } else { '' }
Note "$(if ($id -eq $env:INSTALL_ID) { 'PASS' } else { 'FAIL' })  the profile is kept: install id $(if ($id) { $id } else { 'none' })"
$motw = Get-Content $exe -Stream Zone.Identifier -ErrorAction SilentlyContinue
Note "NOTE  Mark of the Web on the installed Unvibe.exe: $(if ($motw) { $motw -join ' ' } else { 'none' })"
if (-not (Flag 'after-update')) { Note 'FAIL  QA flag after the update' }
if (Select-String -Path "$Out\report.txt" -Pattern '^FAIL' -Quiet) { exit 1 }
exit 0
