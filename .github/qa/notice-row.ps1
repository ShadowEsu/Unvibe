# Design's #213/#218 conditions on Windows, on an RC build: an Island notice, fully inside the work area, no jump when
# it ends after 9 s, and the expanded card's note. The notice: with an empty Notepad in front and the clipboard empty,
# Ctrl+Alt+U can't copy anything, so the app says "Couldn't copy from Notepad..." on its Island (main.ts, win32).
# First, a check of its own: the startup "That shortcut is in use by another app..." notice while another process
# holds Ctrl+Alt+U (lost on 0.1.50: notify() fires before bar.html has loaded; a 0.1.51 fix).
# Usage: notice-row.ps1 -Out <dir>   Env: INSTALL_ID, RC_DIR (the build-only run's Windows artifact)
param([string]$Out)
$ErrorActionPreference = 'Continue'
New-Item -ItemType Directory -Force $Out | Out-Null
function Note($s) { [IO.File]::AppendAllText("$Out\report.txt", "$s`r`n", (New-Object Text.UTF8Encoding $false)); Write-Host $s }
function Verdict($ok, $what) { Note "$(if ($ok) { 'PASS' } else { 'FAIL' })  $what" }
Add-Type -AssemblyName System.Windows.Forms, System.Drawing
Add-Type @"
using System; using System.Runtime.InteropServices; using System.Collections.Generic;
public static class W {
  public delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc f, IntPtr l);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [StructLayout(LayoutKind.Sequential)] public struct R { public int L, T, Rt, B; }
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out R r);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint f, uint x, uint y, uint d, IntPtr e);
  [DllImport("user32.dll")] public static extern void keybd_event(byte vk, byte scan, uint flags, IntPtr extra);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  // The smallest visible window of these processes: the Island (the companion and panel are far larger).
  public static IntPtr Island(HashSet<uint> pids) {
    IntPtr best = IntPtr.Zero; long area = long.MaxValue;
    EnumWindows((h, l) => { uint p; GetWindowThreadProcessId(h, out p); R r;
      if (pids.Contains(p) && IsWindowVisible(h) && GetWindowRect(h, out r)) { long a = (long)(r.Rt - r.L) * (r.B - r.T); if (a > 0 && a < area && r.B - r.T < 400) { area = a; best = h; } }
      return true; }, IntPtr.Zero);
    return best;
  }
}
"@
# The window is larger than the pill it draws (transparent margin; on 2022 it reaches into the dark taskbar): the
# visible pill is the box of dark pixels (the Island's fill) that also differ from the screen before Unvibe started.
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System; using System.Drawing;
public static class Diff {
  public static int[] Box(Bitmap f, Bitmap r, int ox, int oy, int x, int y, int w, int h) {
    int x0 = int.MaxValue, y0 = int.MaxValue, x1 = -1, y1 = -1;
    for (int j = Math.Max(0, y); j < Math.Min(f.Height, y + h); j++)
      for (int i = Math.Max(0, x); i < Math.Min(f.Width, x + w); i++) {
        int sx = ox + i, sy = oy + j;
        if (sx < 0 || sy < 0 || sx >= r.Width || sy >= r.Height) continue;
        Color a = f.GetPixel(i, j), b = r.GetPixel(sx, sy);
        if (a.R < 48 && a.G < 48 && a.B < 48 && Math.Abs(a.R - b.R) + Math.Abs(a.G - b.G) + Math.Abs(a.B - b.B) > 60) { if (i < x0) x0 = i; if (j < y0) y0 = j; if (i > x1) x1 = i; if (j > y1) y1 = j; }
      }
    return x1 < 0 ? null : new int[] { x0, y0, x1, y1 };
  }
}
"@
# Another app holds Ctrl+Alt+U first (MOD_ALT 1 | MOD_CONTROL 2, 'U' 0x55). Registered by this script's own thread,
# so it stays held while the row runs (a child PowerShell holder never reported back on the runners).
Add-Type -TypeDefinition @"
using System; using System.Runtime.InteropServices;
public static class HK {
  [DllImport("user32.dll")] public static extern bool RegisterHotKey(IntPtr h, int id, uint m, uint k);
  [DllImport("user32.dll")] public static extern bool UnregisterHotKey(IntPtr h, int id);
}
"@
function Pids() { $s = New-Object 'System.Collections.Generic.HashSet[uint32]'; Get-Process Unvibe -ErrorAction SilentlyContinue | ForEach-Object { [void]$s.Add([uint32]$_.Id) }; , $s }
function Rect($h) { $r = New-Object 'W+R'; [void][W]::GetWindowRect($h, [ref]$r); $r }
function Crop($r, $name, $pad) {
  $x = [Math]::Max(0, $r.L - $pad); $y = [Math]::Max(0, $r.T - $pad)
  $b = [System.Windows.Forms.SystemInformation]::VirtualScreen
  $w = [Math]::Min($b.Width - $x, $r.Rt - $r.L + 2 * $pad); $ht = [Math]::Min($b.Height - $y, $r.B - $r.T + 2 * $pad)
  $bmp = New-Object System.Drawing.Bitmap $w, $ht
  [System.Drawing.Graphics]::FromImage($bmp).CopyFromScreen($x, $y, 0, 0, $bmp.Size)
  $bmp.Save("$Out\$name.png")
  # The visible pill inside the window rect, in screen coordinates (nothing when no pixel differs from the reference).
  $bx = [Diff]::Box($bmp, $script:ref, $x - $b.Left, $y - $b.Top, $r.L - $x, $r.T - $y, $r.Rt - $r.L, $r.B - $r.T)
  if ($bx) { [pscustomobject]@{ L = $x + $bx[0]; T = $y + $bx[1]; R = $x + $bx[2] + 1; B = $y + $bx[3] + 1 } }
}
function Reference() { # the screen as it is now, before Unvibe starts
  $b = [System.Windows.Forms.SystemInformation]::VirtualScreen
  $script:ref = New-Object System.Drawing.Bitmap $b.Width, $b.Height
  [System.Drawing.Graphics]::FromImage($script:ref).CopyFromScreen($b.Left, $b.Top, 0, 0, $script:ref.Size)
}
function X4($src, $dst) { # 4x nearest-neighbour enlargement, so each screen pixel stays a sharp 4x4 block
  $s = [System.Drawing.Image]::FromFile($src)
  $d = New-Object System.Drawing.Bitmap ($s.Width * 4), ($s.Height * 4)
  $g = [System.Drawing.Graphics]::FromImage($d)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
  $g.DrawImage($s, 0, 0, $d.Width, $d.Height); $d.Save($dst); $g.Dispose(); $d.Dispose(); $s.Dispose()
}
function Full($name) {
  $b = [System.Windows.Forms.SystemInformation]::VirtualScreen
  $bmp = New-Object System.Drawing.Bitmap $b.Width, $b.Height
  [System.Drawing.Graphics]::FromImage($bmp).CopyFromScreen($b.Left, $b.Top, 0, 0, $bmp.Size)
  $bmp.Save("$Out\$name.png")
}

$os = Get-CimInstance Win32_OperatingSystem
Note "ROW notice on $($os.Caption) build $($os.BuildNumber)"
$setup = (Get-ChildItem $env:RC_DIR -Recurse -Filter '*-win-x64-setup.exe' | Select-Object -First 1).FullName
Note "RC setup: $(Split-Path $setup -Leaf), sha256 $((Get-FileHash $setup).Hash.ToLower())"
$p = Start-Process $setup -ArgumentList '/S' -PassThru; $null = $p.Handle; [void]$p.WaitForExit(300000)
$exe = Join-Path $env:LOCALAPPDATA 'Programs\Unvibe\Unvibe.exe'
Note "setup /S exit $($p.ExitCode); $exe $(if (Test-Path $exe) { (Get-Item $exe).VersionInfo.ProductVersion } else { 'MISSING' })"

# A set-up profile (onboarded, the Island always shown, its default bottom-centre place), with this row's qa- id.
$ud = Join-Path $env:APPDATA 'Unvibe'; New-Item -ItemType Directory -Force $ud | Out-Null
$utf8 = New-Object Text.UTF8Encoding $false
[IO.File]::WriteAllText((Join-Path $ud 'unvibe-store.json'), "{`"installId`":`"$env:INSTALL_ID`"}", $utf8)
[IO.File]::WriteAllText((Join-Path $ud 'unvibe-settings.json'), '{"settingsRevision":8,"appearanceRevision":2,"islandBehaviorRevision":4,"ideBridgeShortcutRevision":2,"sidebarDensityRevision":2,"windowsShortcutRevision":1,"setupProgressRevision":1,"onboarded":true,"theme":"light"}', $utf8)

$wa = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
Note "work area: $($wa.Left),$($wa.Top) to $($wa.Right),$($wa.Bottom); screen $([System.Windows.Forms.Screen]::PrimaryScreen.Bounds.Width)x$([System.Windows.Forms.Screen]::PrimaryScreen.Bounds.Height)"
function Watch($seconds, $prefix) { # the Island's bounds and a crop every ~250 ms
  $t = Get-Date; $list = @()
  while (((Get-Date) - $t).TotalSeconds -lt $seconds) {
    $h = [W]::Island((Pids)); $s = [Math]::Round(((Get-Date) - $t).TotalSeconds, 2)
    if ($h -ne [IntPtr]::Zero) {
      $r = Rect $h; $name = "$prefix-{0:00.00}s" -f $s
      $pill = Crop $r $name 30
      $list += [pscustomobject]@{ S = $s; L = $r.L; T = $r.T; R = $r.Rt; B = $r.B; W = $r.Rt - $r.L; H = $r.B - $r.T; PL = $pill.L; PT = $pill.T; PR = $pill.R; PB = $pill.B; File = "$Out\$name.png" }
    }
    Start-Sleep -Milliseconds 200
  }
  $list | ForEach-Object { "{0,6}s  window L {1} T {2} R {3} B {4} ({5}x{6})  pill L {7} T {8} R {9} B {10}" -f $_.S, $_.L, $_.T, $_.R, $_.B, $_.W, $_.H, $_.PL, $_.PT, $_.PR, $_.PB } | Set-Content "$Out\$prefix-bounds.txt"
  , $list
}
function Grown($list) { # frames whose window is at least 40 px taller than the smallest seen
  $min = ($list | Measure-Object H -Minimum).Minimum
  @($list | Where-Object { $_.H -ge $min + 40 })
}
function Press() { # Ctrl+Alt+U
  [W]::keybd_event(0x11, 0, 0, [IntPtr]::Zero); [W]::keybd_event(0x12, 0, 0, [IntPtr]::Zero); [W]::keybd_event(0x55, 0, 0, [IntPtr]::Zero)
  Start-Sleep -Milliseconds 60
  [W]::keybd_event(0x55, 0, 2, [IntPtr]::Zero); [W]::keybd_event(0x12, 0, 2, [IntPtr]::Zero); [W]::keybd_event(0x11, 0, 2, [IntPtr]::Zero)
}

# A. The startup notice while another process (this script's thread) holds Ctrl+Alt+U.
$held = [HK]::RegisterHotKey([IntPtr]::Zero, 1, 3, 0x55)
Note "A. another process holds Ctrl+Alt+U before Unvibe starts: $held"
Reference; Start-Process $exe
$a = Watch 14 'a-startup'
$ga = @(Grown $a)
Note "$(if ($ga.Count) { 'NOTE ' } else { 'NOTE  KNOWN 0.1.51:' }) A. startup 'shortcut in use' notice $(if ($ga.Count) { "shown from $($ga[0].S) s, $($ga[0].W)x$($ga[0].H)" } else { 'never shown in 14 s' })"
Get-Process Unvibe -ErrorAction SilentlyContinue | Stop-Process -Force; Start-Sleep 3
[void][HK]::UnregisterHotKey([IntPtr]::Zero, 1)

# B. The notice on a press that can't copy: empty Notepad in front, clipboard empty.
Reference; Start-Process $exe
$h = [IntPtr]::Zero
for ($i = 0; $i -lt 120 -and $h -eq [IntPtr]::Zero; $i++) { Start-Sleep -Milliseconds 250; $h = [W]::Island((Pids)) }
Start-Sleep 8 # the companion opens and settles; any first-run notice is over
$np = Start-Process notepad.exe -PassThru; Start-Sleep 3
$nh = (Get-Process -Id $np.Id -ErrorAction SilentlyContinue).MainWindowHandle
if (-not $nh -or $nh -eq [IntPtr]::Zero) { $nh = (Get-Process notepad -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne [IntPtr]::Zero } | Select-Object -First 1).MainWindowHandle }
[void][W]::SetForegroundWindow($nh); Start-Sleep 1
try { [System.Windows.Forms.Clipboard]::Clear(); Note "clipboard cleared" } catch { Note "clipboard clear: $($_.Exception.Message)" }
Full 'b-before-press'
Press
$b = Watch 14 'b-notice'
Full 'b-after'
Note "B. Island frames: $($b.Count); window sizes seen: $(($b | ForEach-Object { "$($_.W)x$($_.H)" } | Select-Object -Unique) -join ', ')"
$gb = @(Grown $b)
Verdict ($gb.Count -gt 0) "B. a notice grows the Island (from $(if ($gb) { "$($gb[0].S) s to $($gb[-1].S) s after the press, $($gb[0].W)x$($gb[0].H)" } else { 'never' }))"
if ($gb) {
  $mid = $gb[[int]($gb.Count / 2)]; X4 $mid.File "$Out\island-notice-x4.png"; Copy-Item $mid.File "$Out\island-notice.png"
  $after = @($b | Where-Object { $_.S -gt $gb[-1].S })
  Verdict ($after.Count -gt 0) "B. the notice ends and the Island is compact again within the 14 s watch (shown about $([Math]::Round($gb[-1].S - $gb[0].S, 1)) s; 9 s expected; $($after.Count) compact frames after)"
}
$seen = @($b | Where-Object { $null -ne $_.PB })
$outside = @($seen | Where-Object { $_.PL -lt $wa.Left -or $_.PT -lt $wa.Top -or $_.PR -gt $wa.Right -or $_.PB -gt $wa.Bottom })
Verdict ($seen.Count -gt 0 -and $outside.Count -eq 0) "B. the visible pill stays inside the work area in every frame ($($seen.Count) frames with a pill, $($outside.Count) outside; pill tops $(($seen | ForEach-Object { $_.PT } | Select-Object -Unique) -join ', '), bottoms $(($seen | ForEach-Object { $_.PB } | Select-Object -Unique) -join ', '); work area $($wa.Top)-$($wa.Bottom))"
$bottoms = $seen | ForEach-Object { $_.PB } | Measure-Object -Minimum -Maximum
Verdict ($seen.Count -gt 0 -and ($bottoms.Maximum - $bottoms.Minimum) -le 1) "B. no jump: the bottom-centre pill keeps its bottom edge through the notice and its end (bottom edge $($bottoms.Minimum)-$($bottoms.Maximum))"
$last = $b | Select-Object -Last 1
if ($last) { X4 $last.File "$Out\island-compact-x4.png"; Note "compact Island after the notice, 4x: island-compact-x4.png ($($last.W)x$($last.H))" }

# C. #218: press again (past notify's 15 s gap), click the compact row while the notice shows, picture the card.
Start-Sleep 3
[void][W]::SetForegroundWindow($nh); Start-Sleep 1
Press; Start-Sleep 1.5
$h = [W]::Island((Pids))
if ($h -ne [IntPtr]::Zero) {
  $r = Rect $h
  $pb = Crop $r 'c-click-before' 30
  # The compact row is the bottom of a bottom pill while the notice shows above it: click its middle.
  $cx = if ($pb) { [int](($pb.L + $pb.R) / 2) } else { [int](($r.L + $r.Rt) / 2) }; $cy = if ($pb) { $pb.B - 18 } else { $r.B - 22 }
  [void][W]::SetCursorPos($cx, $cy); Start-Sleep -Milliseconds 300
  [W]::mouse_event(0x2, 0, 0, 0, [IntPtr]::Zero); Start-Sleep -Milliseconds 80; [W]::mouse_event(0x4, 0, 0, 0, [IntPtr]::Zero)
  Start-Sleep 1.5
  $h2 = [W]::Island((Pids)); $r2 = Rect $h2
  Verdict (($r2.B - $r2.T) -gt ($r.B - $r.T) + 40) "C. a click on the Island opens the expanded card (clicked $cx,$cy; window before $($r.Rt - $r.L)x$($r.B - $r.T), after $($r2.Rt - $r2.L)x$($r2.B - $r2.T) at $($r2.L),$($r2.T))"
  Full 'c-expanded-card'
  $null = Crop $r2 'c-expanded-card-crop' 30
} else { Note 'FAIL  C. no Island for the click' }
Get-Process Unvibe, notepad -ErrorAction SilentlyContinue | Stop-Process -Force
if (Select-String -Path "$Out\report.txt" -Pattern '^\s*FAIL' -Quiet) { exit 1 }
exit 0
