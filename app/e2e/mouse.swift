// QA helper for two-app-take.mjs, rc-0154.mjs and setup-0157.mjs (macOS runner): an app's window frame, the main
// display's mode, and real mouse input (the same CGEvent input as .github/qa/gkwin.swift on qa/install-matrix). Built on
// the runner: swiftc -O -o mouse mouse.swift
//   mouse frame <owner>               "x y w h" of that owner's largest on-screen window (screen points), exit 1 if none
//   mouse display <w> <h>             the main display to its smallest mode of at least w x h points (public
//                                     CoreGraphics API); prints the modes and the result
//   mouse click <x> <y> <n>           n clicks at x,y as one multi-click (n = 3 selects a line in Terminal)
//   mouse drag <x1> <y1> <x2> <y2>    a move to x1,y1, press, move there in 24 steps (each with its delta) to x2,y2, release
//   mouse move <x> <y>                the pointer to x,y (a real move event), no button
import CoreGraphics
import Foundation

func onScreen() -> [[String: Any]] {
  let options: CGWindowListOption = [.optionOnScreenOnly, .excludeDesktopElements]
  return (CGWindowListCopyWindowInfo(options, kCGNullWindowID) as? [[String: Any]]) ?? []
}

func frame(_ w: [String: Any]) -> CGRect {
  guard let d = w[kCGWindowBounds as String] else { return .zero }
  return CGRect(dictionaryRepresentation: d as! CFDictionary) ?? .zero
}

/// One mouse event. A drag step also carries its movement (kCGMouseEventDeltaX/Y), as a real mouse's does: AppKit's
/// window drag may follow the deltas, not the positions (unvibe-app's read of run 44663887449).
func post(_ type: CGEventType, _ p: CGPoint, clicks: Int64 = 1, dx: Int64 = 0, dy: Int64 = 0) {
  guard let e = CGEvent(mouseEventSource: nil, mouseType: type, mouseCursorPosition: p, mouseButton: .left) else { exit(3) }
  e.setIntegerValueField(.mouseEventClickState, value: clicks)
  if dx != 0 || dy != 0 {
    e.setIntegerValueField(.mouseEventDeltaX, value: dx)
    e.setIntegerValueField(.mouseEventDeltaY, value: dy)
  }
  e.post(tap: .cghidEventTap)
}

let a = CommandLine.arguments
guard a.count > 1 else { exit(2) }
switch a[1] {
case "display" where a.count > 3:
  let main = CGMainDisplayID()
  let wantW = Int(a[2]) ?? 0, wantH = Int(a[3]) ?? 0
  let was = "\(CGDisplayPixelsWide(main))x\(CGDisplayPixelsHigh(main))"
  let modes = (CGDisplayCopyAllDisplayModes(main, nil) as? [CGDisplayMode]) ?? []
  let names = Set(modes.map { "\($0.width)x\($0.height)" }).sorted()
  let fit = modes
    .filter { $0.width >= wantW && $0.height >= wantH && $0.isUsableForDesktopGUI() }
    .sorted { $0.width * $0.height < $1.width * $1.height }
    .first
  var result = "no mode of at least \(wantW)x\(wantH)"
  if let m = fit { result = "CGDisplaySetDisplayMode \(m.width)x\(m.height) returned \(CGDisplaySetDisplayMode(main, m, nil).rawValue)" }
  print("was \(was); modes \(names.joined(separator: " ")); \(result); now \(CGDisplayPixelsWide(main))x\(CGDisplayPixelsHigh(main))")
case "frame" where a.count > 2:
  // Layer 0 only: an app's normal windows, not its menu bar items.
  let hits = onScreen()
    .filter { ($0[kCGWindowOwnerName as String] as? String) == a[2] && ($0[kCGWindowLayer as String] as? Int ?? 0) == 0 }
    .sorted { frame($0).width * frame($0).height > frame($1).width * frame($1).height }
  guard let w = hits.first else { exit(1) }
  let r = frame(w)
  print("\(Int(r.minX)) \(Int(r.minY)) \(Int(r.width)) \(Int(r.height))")
case "click" where a.count > 4:
  let p = CGPoint(x: Double(a[2]) ?? 0, y: Double(a[3]) ?? 0)
  CGWarpMouseCursorPosition(p)
  usleep(120_000)
  for i in 1...max(1, Int(a[4]) ?? 1) {
    post(.leftMouseDown, p, clicks: Int64(i))
    usleep(30_000)
    post(.leftMouseUp, p, clicks: Int64(i))
    usleep(60_000)
  }
case "drag" where a.count > 5:
  let p1 = CGPoint(x: Double(a[2]) ?? 0, y: Double(a[3]) ?? 0)
  let p2 = CGPoint(x: Double(a[4]) ?? 0, y: Double(a[5]) ?? 0)
  CGWarpMouseCursorPosition(p1)
  post(.mouseMoved, p1)
  usleep(150_000)
  post(.leftMouseDown, p1)
  usleep(80_000)
  var last = p1
  for i in 1...24 {
    let t = Double(i) / 24
    let p = CGPoint(x: (p1.x + (p2.x - p1.x) * t).rounded(), y: (p1.y + (p2.y - p1.y) * t).rounded())
    post(.leftMouseDragged, p, dx: Int64(p.x - last.x), dy: Int64(p.y - last.y))
    last = p
    usleep(20_000)
  }
  post(.leftMouseUp, p2)
case "move" where a.count > 3:
  let p = CGPoint(x: Double(a[2]) ?? 0, y: Double(a[3]) ?? 0)
  CGWarpMouseCursorPosition(p)
  post(.mouseMoved, p)
default:
  exit(2)
}
