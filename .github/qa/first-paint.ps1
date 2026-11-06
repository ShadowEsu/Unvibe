# #208 check, run in the background next to a launch: polls every 50 ms for the first visible Unvibe main window
# (at least 400x300, so not the Island), pictures it at once and 3 s later, and records how uniform its client area is
# below the 48 px caption band (an empty page is ~100% one colour; the maximized window rect also covers the taskbar
# strip, so the rect is not used), whether it was in front, how many main windows show, and, every ~100 ms after it
# shows, when content first appears.
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
  [DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr h, out R r);
  [StructLayout(LayoutKind.Sequential)] public struct P { public int X, Y; }
  [DllImport("user32.dll")] public static extern bool ClientToScreen(IntPtr h, ref P p);
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
# The client area below the caption band, in screen coordinates.
function Area($h) {
  $c = New-Object W+R; [void][W]::GetClientRect($h, [ref]$c)
  $p = New-Object W+P; [void][W]::ClientToScreen($h, [ref]$p)
  @{ X = $p.X; Y = $p.Y + 48; W = $c.Rt - $c.L; H = [Math]::Max(1, $c.B - $c.T - 48) }
}
function Uniform($bmp) { # most common colour % and colour count over a ~60x60 sample grid
  $counts = @{}; $n = 0; $sx = [Math]::Max(1, [int]($bmp.Width / 60)); $sy = [Math]::Max(1, [int]($bmp.Height / 60))
  for ($x = 0; $x -lt $bmp.Width; $x += $sx) { for ($y = 0; $y -lt $bmp.Height; $y += $sy) { $c = $bmp.GetPixel($x, $y).ToArgb(); $counts[$c] = 1 + [int]$counts[$c]; $n++ } }
  $top = ($counts.Values | Measure-Object -Maximum).Maximum
  @{ Pct = [Math]::Round(100 * $top / $n, 1); Colours = $counts.Count; N = $n }
}
function Grab($h) {
  $a = Area $h
  $bmp = New-Object System.Drawing.Bitmap $a.W, $a.H
  [System.Drawing.Graphics]::FromImage($bmp).CopyFromScreen($a.X, $a.Y, 0, 0, $bmp.Size)
  $bmp
}
function Capture($h, $name) {
  $r = New-Object W+R; [void][W]::GetWindowRect($h, [ref]$r)
  $bmp = Grab $h; $bmp.Save((Join-Path $Out "first-paint-$Tag-$name.png")); $u = Uniform $bmp
  "$($r.Rt - $r.L) x $($r.B - $r.T) at $($r.L),$($r.T); client area below the caption: most common colour $($u.Pct)% of $($u.N) samples, $($u.Colours) colours"
}
function Blank($u) { $u.Pct -ge 97 -or $u.Colours -lt 20 }
$t0 = Get-Date
while (((Get-Date) - $t0).TotalSeconds -lt $Seconds) {
  $wins = [W]::MainWindows((Pids))
  if ($wins.Count -gt 0) {
    $h = $wins[0]; $ms = [int]((Get-Date) - $t0).TotalMilliseconds
    $front = [W]::GetForegroundWindow() -eq $h
    Line "first visible main window at $ms ms after the watch began: $(Capture $h 'first'); in front: $front; main windows: $($wins.Count)"
    # How long the empty page lasts: ~100 ms samples for up to 10 s after it shows.
    $shown = Get-Date; $content = $null; $blankAt = @()
    while (((Get-Date) - $shown).TotalSeconds -lt 10) {
      $u = Uniform (Grab $h); $at = [int]((Get-Date) - $shown).TotalMilliseconds
      if (Blank $u) { $blankAt += $at } else { $content = $at; break }
      Start-Sleep -Milliseconds 50
    }
    Line "content first seen: $(if ($null -ne $content) { "$content ms after the window showed" } else { 'not within 10 s' }); blank samples: $($blankAt.Count) (last at $(if ($blankAt) { $blankAt[-1] } else { '-' }) ms)"
    Start-Sleep 3
    $wins = [W]::MainWindows((Pids))
    Line "3 s later: $(if ($wins.Count) { Capture $wins[0] 'later' } else { 'no main window' }); in front: $([W]::GetForegroundWindow() -eq $wins[0]); main windows: $($wins.Count); Unvibe processes: $(@(Get-Process Unvibe -ErrorAction SilentlyContinue).Count)"
    exit 0
  }
  Start-Sleep -Milliseconds 50
}
Line "no visible Unvibe main window within $Seconds s"
