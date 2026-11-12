# Runs in the background during qa-admin-win.yml's rows and logs every powershell.exe that starts: when (UTC), its
# parent, and whether its command line sends the copy keystroke (SendKeys) or looks up the foreground window. Unvibe sends
# each copy keystroke from its own powershell.exe (selection.ts PS_COPY), so these lines count the keystrokes it sent,
# even to a window that drops them (UIPI). Reads only; writes <Out>\proc-watch.log.
# Usage: proc-watch.ps1 -Out <dir> [-Seconds 1500]
param([string]$Out, [int]$Seconds = 1500)
$log = Join-Path $Out 'proc-watch.log'
New-Item -ItemType Directory -Force $Out | Out-Null
# WMI checks for new processes every 100 ms; the app's PowerShell runs live ~0.5 s or more (it loads an assembly first).
$q = "SELECT * FROM __InstanceCreationEvent WITHIN 0.1 WHERE TargetInstance ISA 'Win32_Process' AND TargetInstance.Name = 'powershell.exe'"
Register-CimIndicationEvent -Query $q -SourceIdentifier qaPs | Out-Null
Add-Content -Path $log -Value "$((Get-Date).ToUniversalTime().ToString('HH:mm:ss.fff')) start watching powershell.exe starts for $Seconds s" -Encoding utf8
$t0 = Get-Date
while (((Get-Date) - $t0).TotalSeconds -lt $Seconds) {
  $e = Wait-Event -SourceIdentifier qaPs -Timeout 1
  if (-not $e) { continue }
  $p = $e.SourceEventArgs.NewEvent.TargetInstance
  $at = [DateTime]::FromFileTimeUtc([long]$e.SourceEventArgs.NewEvent.TIME_CREATED).ToString('HH:mm:ss.fff')
  $parent = (Get-Process -Id $p.ParentProcessId -ErrorAction SilentlyContinue).ProcessName
  $cl = [string]$p.CommandLine
  Add-Content -Path $log -Value ('{0} pid {1} parent {2}#{3} sendkeys={4} foreground={5}' -f $at, $p.ProcessId, $parent, $p.ParentProcessId, ($cl -match 'SendKeys'), ($cl -match 'GetForegroundWindow')) -Encoding utf8
  Remove-Event -EventIdentifier $e.EventIdentifier
}
Unregister-Event -SourceIdentifier qaPs
