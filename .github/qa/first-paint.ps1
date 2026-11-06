# #208 check, run in the background next to a launch: polls every 50 ms for the first visible Unvibe main window
# (at least 400x300, so not the Island), pictures it at once and 3 s later, and records how uniform each picture is
# (a blank white window is ~100% one colour), whether it was in front, and how many main windows show.
# Usage: first-paint.ps1 -Out <dir> -Tag <name> [-Seconds 150]   Writes <Out>\first-paint-<Tag>.txt and two PNGs.
param([string]$Out, [string]$Tag, [int]$Seconds = 150)
Add-Type -AssemblyName System.Drawing
Add-Type @"
using System; using System.Runtime.InteropServices; using System.Collections.Generic;
public static class W {
  public delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc f, IntPtr l);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [StructLayout(LayoutKind.Sequential)] public struct R { public int L, T, Rt, B; }
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out R r);
  // Not "Main": a static Main with this signature is warning CS0028, and Add-Type fails on warnings.
  public static List<IntPtr> MainWindows(HashSet<uint> pids) {
    var res = new List<IntPtr>();
    EnumWindows((h, l) => { uint p; GetWindowThreadProcessId(h, out p); R r;
      if (pids.Contains(p) && IsWindowVisible(h) && GetWindowRect(h, out r) && r.Rt - r.L >= 400 && r.B - r.T >= 300) res.Add(h);
      return true; }, IntPtr.Zero);
    return res;
  }
}
"@
$file = Join-Path $Out "first-paint-$Tag.txt"
function Line($s) { Add-Content -Path $file -Value $s -Encoding utf8 }
function Pids() { $s = New-Object 'System.Collections.Generic.HashSet[uint32]'; Get-Process Unvibe -ErrorAction SilentlyContinue | ForEach-Object { [void]$s.Add([uint32]$_.Id) }; , $s }
function Capture($h, $name) {
  $r = New-Object W+R; [void][W]::GetWindowRect($h, [ref]$r)
  $w = $r.Rt - $r.L; $ht = $r.B - $r.T
  $bmp = New-Object System.Drawing.Bitmap $w, $ht
  [System.Drawing.Graphics]::FromImage($bmp).CopyFromScreen($r.L, $r.T, 0, 0, $bmp.Size)
  $bmp.Save((Join-Path $Out "first-paint-$Tag-$name.png"))
  $counts = @{}; $n = 0; $sx = [Math]::Max(1, [int]($w / 60)); $sy = [Math]::Max(1, [int]($ht / 60))
  for ($x = 4; $x -lt $w - 4; $x += $sx) { for ($y = 4; $y -lt $ht - 4; $y += $sy) { $c = $bmp.GetPixel($x, $y).ToArgb(); $counts[$c] = 1 + [int]$counts[$c]; $n++ } }
  $top = ($counts.Values | Measure-Object -Maximum).Maximum
  "$w x $ht at $($r.L),$($r.T); most common colour $([Math]::Round(100 * $top / $n, 1))% of $n samples, $($counts.Count) colours"
}
$t0 = Get-Date
while (((Get-Date) - $t0).TotalSeconds -lt $Seconds) {
  $wins = [W]::MainWindows((Pids))
  if ($wins.Count -gt 0) {
    $h = $wins[0]; $ms = [int]((Get-Date) - $t0).TotalMilliseconds
    $front = [W]::GetForegroundWindow() -eq $h
    Line "first visible main window at $ms ms after the watch began: $(Capture $h 'first'); in front: $front; main windows: $($wins.Count)"
    Start-Sleep 3
    $wins = [W]::MainWindows((Pids))
    Line "3 s later: $(if ($wins.Count) { Capture $wins[0] 'later' } else { 'no main window' }); in front: $([W]::GetForegroundWindow() -eq $wins[0]); main windows: $($wins.Count); Unvibe processes: $(@(Get-Process Unvibe -ErrorAction SilentlyContinue).Count)"
    exit 0
  }
  Start-Sleep -Milliseconds 50
}
Line "no visible Unvibe main window within $Seconds s"
