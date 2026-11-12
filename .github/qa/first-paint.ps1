# #208 check, run in the background next to a launch: polls every 50 ms for the first visible Unvibe main window
# (at least 400x300, so not the Island), pictures it at once and 3 s later, and records how uniform its client area is
# below the 48 px caption band (an empty page is ~100% one colour; the maximized window rect also covers the taskbar
# strip, so the rect is not used), whether it was in front, how many main windows show, and, every ~100 ms after it
# shows, when content first appears.
# Each frame is one of: "stage" (the start stage's ground and nothing else, 0.1.52: returning launches open on it),
# "blank" (an empty page: one colour or almost), "content" (anything else: the sharks on the stage, or the app).
# Usage: first-paint.ps1 -Out <dir> -Tag <name> [-Seconds 150]   Writes <Out>\first-paint-<Tag>.txt and two PNGs.
param([string]$Out, [string]$Tag, [int]$Seconds = 150)
Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing @"
using System; using System.Drawing; using System.Collections.Generic;
public static class Px {
  // Over a ~60x60 grid: [0] most common colour's share %, [1] colours, [2] samples, [3] most common colour (0xRRGGBB),
  // [4] share % of samples the start stage's ground can produce. Compiled: a PowerShell loop cost 32-84 ms a frame.
  public static double[] Stats(Bitmap b) {
    Dictionary<int, int> counts = new Dictionary<int, int>(); int n = 0, stage = 0;
    int sx = Math.Max(1, b.Width / 60), sy = Math.Max(1, b.Height / 60);
    for (int x = 0; x < b.Width; x += sx) {
      for (int y = 0; y < b.Height; y += sy) {
        Color c = b.GetPixel(x, y); int k = c.ToArgb() & 0xFFFFFF; int v;
        counts.TryGetValue(k, out v); counts[k] = v + 1; n++;
        if (StageGround(c.R, c.G, c.B)) stage++;
      }
    }
    int top = 0, topK = 0;
    foreach (KeyValuePair<int, int> kv in counts) { if (kv.Value > top) { top = kv.Value; topK = kv.Key; } }
    return new double[] { Math.Round(100.0 * top / n, 1), counts.Count, n, topK, Math.Round(100.0 * stage / n, 1) };
  }
  // The stage's ground (app-0151.css: rgb(16 12 34 / 0.8) over aurora.webp over #16122a) is 0.8 x (16,12,34) plus
  // 0.2 x any colour: R 12.8-63.8, G 9.6-60.6, B 27.2-78.2 (the button strip #17122f is inside too); +-2 for rounding.
  static bool StageGround(int r, int g, int b) { return r >= 11 && r <= 66 && g >= 8 && g <= 63 && b >= 25 && b <= 80; }
}
"@
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
function Uniform($bmp) { # most common colour % and colour count over a ~60x60 sample grid, plus the stage share
  $s = [Px]::Stats($bmp)
  @{ Pct = $s[0]; Colours = [int]$s[1]; N = [int]$s[2]; Top = '#{0:x6}' -f [int]$s[3]; Stage = $s[4] }
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
  "$($r.Rt - $r.L) x $($r.B - $r.T) at $($r.L),$($r.T); client area below the caption: most common colour $($u.Pct)% of $($u.N) samples, $($u.Colours) colours; top colour $($u.Top); stage ground $($u.Stage)%; kind $(Kind $u)"
}
function Blank($u) { $u.Pct -ge 97 -or $u.Colours -lt 20 }
# The stage's ground alone: nearly every sample is a colour the ground can produce (the sharks or the app break it).
function Stage($u) { $u.Stage -ge 99.5 }
function Kind($u) { if (Stage $u) { 'stage' } elseif (Blank $u) { 'blank' } else { 'content' } }
$t0 = Get-Date
while (((Get-Date) - $t0).TotalSeconds -lt $Seconds) {
  $wins = [W]::MainWindows((Pids))
  if ($wins.Count -gt 0) {
    $h = $wins[0]; $shown = Get-Date; $ms = [int]($shown - $t0).TotalMilliseconds
    $front = [W]::GetForegroundWindow() -eq $h
    # Grab the first frame into memory only: saving and measuring it come after the timeline, so sampling starts at once.
    $firstBmp = Grab $h; $capMs = [int]((Get-Date) - $shown).TotalMilliseconds
    # How long the empty page lasts: samples every ~100 ms for up to 10 s, timed from the moment the window was seen.
    $content = $null; $blankAt = @(); $sampleMs = @(); $frames = @()
    while (((Get-Date) - $shown).TotalSeconds -lt 10) {
      $s0 = Get-Date; $u = Uniform (Grab $h); $at = [int]((Get-Date) - $shown).TotalMilliseconds; $sampleMs += [int]((Get-Date) - $s0).TotalMilliseconds
      $k = Kind $u; $frames += "$at $k $($u.Stage)%"
      if ($k -ne 'content') { $blankAt += $at } else { $content = $at; break }
      Start-Sleep -Milliseconds 50
    }
    $firstBmp.Save((Join-Path $Out "first-paint-$Tag-first.png")); $u1 = Uniform $firstBmp
    $wr = New-Object W+R; [void][W]::GetWindowRect($h, [ref]$wr)
    $first = "$($wr.Rt - $wr.L) x $($wr.B - $wr.T) at $($wr.L),$($wr.T); client area below the caption: most common colour $($u1.Pct)% of $($u1.N) samples, $($u1.Colours) colours; top colour $($u1.Top); stage ground $($u1.Stage)%; kind $(Kind $u1)"
    Line "first visible main window at $ms ms after the watch began (seen within 50 ms of showing): $first; in front: $front; main windows: $($wins.Count); grabbed by $capMs ms"
    $firstBlank = (Kind $u1) -ne 'content'
    Line "blank timeline (ms from the window being seen): first frame $(if ($firstBlank) { "without content ($(Kind $u1))" } else { 'had content' }) (captured by $capMs ms); later samples without content at $(if ($blankAt) { $blankAt -join ', ' } else { 'none' }); content first seen at $(if ($null -ne $content) { "$content ms" } else { 'not within 10 s' }); sample cost $(if ($sampleMs) { "$(($sampleMs | Measure-Object -Average).Average.ToString('0')) ms avg" } else { '-' })"
    Line "frames (ms from the window being seen, kind, stage ground share): first@$capMs $(Kind $u1) $($u1.Stage)%; $($frames -join '; ')"
    Start-Sleep 3
    $wins = [W]::MainWindows((Pids))
    Line "3 s later: $(if ($wins.Count) { Capture $wins[0] 'later' } else { 'no main window' }); in front: $([W]::GetForegroundWindow() -eq $wins[0]); main windows: $($wins.Count); Unvibe processes: $(@(Get-Process Unvibe -ErrorAction SilentlyContinue).Count)"
    exit 0
  }
  Start-Sleep -Milliseconds 50
}
Line "no visible Unvibe main window within $Seconds s"
