// QA helper for qa-rc-0150-mac.yml (0.1.50 RC stills). Screen points, top-left origin (CGWindowList / CGEvent space).
//   rcmac screen                          main screen frame, visible frame (work area), scale, notch insets
//   rcmac key <keycode>                   one key press through the HID event tap (53 = Escape)
//   rcmac ax <owner>                      every AX element of that owner's windows: role, title, value, frame
//   rcmac axpress <owner> <title>         AXPress on the owner's button with that title (’ and ' match); exit 1 if none
//   rcmac winfor <owner> <x> <y> <w>      CG window number of the owner's on-screen window at x,y with width w (±3)
//   rcmac bounds <window number>          "x y w h" of that window
//   rcmac waitgrow <num> <h0> <secs>      waits until the window is taller than h0 + 20; prints the ms it took
//   rcmac timeline <num> <h0> <out> <tag> <region x,y,w,h> <seconds,...>
//       waits (20 s max) for the window to grow past h0 + 20 (t0 = the notice is up), then at each t0 + second:
//       reads the window's bounds and starts `screencapture -x -R region` (not waited on, so the cadence holds);
//       prints a CSV line per frame: planned_s,actual_ms,x,y,w,h,file
//   rcmac enlarge <in.png> <out.png> <n>  nearest-neighbour n× enlargement (every source pixel an n×n block)
//   rcmac move <x> <y>                    moves the pointer there (no click)
import AppKit
import ApplicationServices
import CoreGraphics
import Foundation
import ImageIO

func windows(_ options: CGWindowListOption, _ id: CGWindowID = kCGNullWindowID) -> [[String: Any]] {
  (CGWindowListCopyWindowInfo(options, id) as? [[String: Any]]) ?? []
}
func frame(_ w: [String: Any]) -> CGRect {
  guard let d = w[kCGWindowBounds as String] else { return .zero }
  return CGRect(dictionaryRepresentation: d as! CFDictionary) ?? .zero
}
func owner(_ w: [String: Any]) -> String { w[kCGWindowOwnerName as String] as? String ?? "?" }
func bounds(_ num: Int) -> CGRect? {
  windows([.optionIncludingWindow], CGWindowID(num)).first.map(frame)
}
func fmt(_ r: CGRect) -> String { "\(Int(r.minX)) \(Int(r.minY)) \(Int(r.width)) \(Int(r.height))" }
func now() -> Double { Date().timeIntervalSince1970 }

func attr(_ e: AXUIElement, _ name: String) -> AnyObject? {
  var v: AnyObject?
  return AXUIElementCopyAttributeValue(e, name as CFString, &v) == .success ? v : nil
}
func str(_ e: AXUIElement, _ name: String) -> String { (attr(e, name) as? String) ?? "" }
func axFrame(_ e: AXUIElement) -> String {
  var p = CGPoint.zero, s = CGSize.zero
  if let v = attr(e, kAXPositionAttribute) { AXValueGetValue(v as! AXValue, .cgPoint, &p) }
  if let v = attr(e, kAXSizeAttribute) { AXValueGetValue(v as! AXValue, .cgSize, &s) }
  return "\(Int(p.x)),\(Int(p.y)) \(Int(s.width))x\(Int(s.height))"
}
func walk(_ e: AXUIElement, _ depth: Int, _ visit: (AXUIElement, Int) -> Bool) -> Bool {
  if visit(e, depth) { return true }
  if depth > 12 { return false }
  for c in (attr(e, kAXChildrenAttribute) as? [AXUIElement]) ?? [] where walk(c, depth + 1, visit) { return true }
  return false
}
func ownerPids(_ name: String) -> [pid_t] {
  Array(Set(windows([.optionOnScreenOnly]).filter { owner($0) == name }.compactMap { $0[kCGWindowOwnerPID as String] as? Int }.map { pid_t($0) }))
}
func norm(_ s: String) -> String { s.replacingOccurrences(of: "\u{2019}", with: "'").trimmingCharacters(in: .whitespaces) }

let a = CommandLine.arguments
guard a.count > 1 else { exit(2) }
switch a[1] {
case "screen":
  guard let s = NSScreen.main ?? NSScreen.screens.first else { print("no screen"); exit(1) }
  let f = s.frame, v = s.visibleFrame
  // NSScreen is bottom-left; flip into the top-left space CGWindowList uses.
  let vt = f.height - (v.minY + v.height)
  var notch = "none"
  if #available(macOS 12.0, *) {
    notch = "safeAreaInsets.top=\(Int(s.safeAreaInsets.top)) auxiliaryTopLeftArea=\(s.auxiliaryTopLeftArea.map { "\(Int($0.width))x\(Int($0.height))" } ?? "nil")"
  }
  print("frame \(Int(f.minX)) 0 \(Int(f.width)) \(Int(f.height)) visible \(Int(v.minX)) \(Int(vt)) \(Int(v.width)) \(Int(v.height)) scale \(s.backingScaleFactor) \(notch)")
case "key" where a.count > 2:
  let code = CGKeyCode(Int(a[2]) ?? 53)
  CGEvent(keyboardEventSource: nil, virtualKey: code, keyDown: true)?.post(tap: .cghidEventTap)
  usleep(60_000)
  CGEvent(keyboardEventSource: nil, virtualKey: code, keyDown: false)?.post(tap: .cghidEventTap)
case "ax" where a.count > 2:
  print("AXIsProcessTrusted=\(AXIsProcessTrusted())")
  for pid in ownerPids(a[2]) {
    let app = AXUIElementCreateApplication(pid)
    for w in (attr(app, kAXWindowsAttribute) as? [AXUIElement]) ?? [] {
      _ = walk(w, 0) { e, d in
        let parts = [str(e, kAXRoleAttribute), str(e, kAXTitleAttribute), str(e, kAXValueAttribute), str(e, kAXDescriptionAttribute)]
        print("\(String(repeating: "  ", count: d))\(parts.filter { !$0.isEmpty }.joined(separator: " | ")) @ \(axFrame(e))")
        return false
      }
    }
  }
case "axpress" where a.count > 3:
  let want = norm(a[3])
  var pressed = false
  for pid in ownerPids(a[2]) where !pressed {
    let app = AXUIElementCreateApplication(pid)
    for w in (attr(app, kAXWindowsAttribute) as? [AXUIElement]) ?? [] where !pressed {
      pressed = walk(w, 0) { e, _ in
        guard str(e, kAXRoleAttribute) == kAXButtonRole as String, norm(str(e, kAXTitleAttribute)) == want else { return false }
        let err = AXUIElementPerformAction(e, kAXPressAction as CFString)
        print("AXPress \"\(str(e, kAXTitleAttribute))\" @ \(axFrame(e)): \(err == .success ? "ok" : "error \(err.rawValue)")")
        return err == .success
      }
    }
  }
  if !pressed { print("no button \"\(want)\" pressed (AXIsProcessTrusted=\(AXIsProcessTrusted()))"); exit(1) }
case "winfor" where a.count > 5:
  let x = Double(a[3]) ?? 0, y = Double(a[4]) ?? 0, w = Double(a[5]) ?? 0
  let hit = windows([.optionOnScreenOnly]).first {
    let r = frame($0)
    return owner($0) == a[2] && abs(r.minX - x) <= 3 && abs(r.minY - y) <= 3 && abs(r.width - w) <= 3
  }
  guard let h = hit else { exit(1) }
  print(h[kCGWindowNumber as String] as? Int ?? 0)
case "bounds" where a.count > 2:
  guard let r = bounds(Int(a[2]) ?? 0) else { exit(1) }
  print(fmt(r))
case "waitgrow" where a.count > 4:
  let num = Int(a[2]) ?? 0, h0 = Double(a[3]) ?? 0, limit = Double(a[4]) ?? 20
  let start = now()
  while now() - start < limit {
    if let r = bounds(num), r.height > h0 + 20 { print(Int((now() - start) * 1000)); exit(0) }
    usleep(20_000)
  }
  exit(1)
case "timeline" where a.count > 7:
  let num = Int(a[2]) ?? 0, h0 = Double(a[3]) ?? 0, out = a[4], tag = a[5], region = a[6]
  let plan = a[7].split(separator: ",").compactMap { Double($0) }
  let start = now()
  var t0 = 0.0
  while now() - start < 20 {
    if let r = bounds(num), r.height > h0 + 20 { t0 = now(); break }
    usleep(15_000)
  }
  guard t0 > 0 else { print("no growth within 20 s"); exit(1) }
  print("# window \(num) grew past \(Int(h0)) + 20 px \(Int((t0 - start) * 1000)) ms after the watch started (t0); bounds then: \(bounds(num).map(fmt) ?? "gone")")
  var shots: [Process] = []
  for s in plan {
    let wait = t0 + s - now()
    if wait > 0 { usleep(useconds_t(wait * 1_000_000)) }
    let r = bounds(num)
    let label = String(format: "%05.2fs", s).replacingOccurrences(of: ".", with: "_")
    let file = "\(out)/\(tag)-\(label).png"
    let p = Process()
    p.executableURL = URL(fileURLWithPath: "/usr/sbin/screencapture")
    p.arguments = ["-x", "-R", region, file]
    try? p.run()
    shots.append(p)
    print("\(s),\(Int((now() - t0) * 1000)),\(r.map { fmt($0).replacingOccurrences(of: " ", with: ",") } ?? "gone,,,"),\(file)")
    fflush(stdout)
  }
  for p in shots { p.waitUntilExit() }
case "enlarge" where a.count > 4:
  let n = Int(a[4]) ?? 4
  guard let src = CGImageSourceCreateWithURL(URL(fileURLWithPath: a[2]) as CFURL, nil),
        let img = CGImageSourceCreateImageAtIndex(src, 0, nil) else { print("cannot read \(a[2])"); exit(1) }
  // Same colour space as the capture, so no pixel value is converted; no interpolation, so every pixel is a sharp block.
  let srgb = CGColorSpace(name: CGColorSpace.sRGB)!
  func context(_ s: CGColorSpace) -> CGContext? {
    CGContext(data: nil, width: img.width * n, height: img.height * n, bitsPerComponent: 8, bytesPerRow: 0,
              space: s, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)
  }
  guard let ctx = context(img.colorSpace ?? srgb) ?? context(srgb) else { print("no bitmap context"); exit(1) }
  print("colour space: \(ctx.colorSpace?.name.map { $0 as String } ?? "unnamed (the capture's own profile)")")
  ctx.interpolationQuality = .none
  ctx.setShouldAntialias(false)
  ctx.draw(img, in: CGRect(x: 0, y: 0, width: img.width * n, height: img.height * n))
  guard let big = ctx.makeImage(),
        let dst = CGImageDestinationCreateWithURL(URL(fileURLWithPath: a[3]) as CFURL, "public.png" as CFString, 1, nil) else { exit(1) }
  CGImageDestinationAddImage(dst, big, nil)
  guard CGImageDestinationFinalize(dst) else { exit(1) }
  print("\(img.width)x\(img.height) -> \(big.width)x\(big.height)")
case "move" where a.count > 3:
  let p = CGPoint(x: Double(a[2]) ?? 0, y: Double(a[3]) ?? 0)
  CGWarpMouseCursorPosition(p)
  CGEvent(mouseEventSource: nil, mouseType: .mouseMoved, mouseCursorPosition: p, mouseButton: .left)?.post(tap: .cghidEventTap)
default:
  exit(2)
}
