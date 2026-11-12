// QA helper for two-app-take.mjs (macOS runner): an app's window frame, and real mouse input (the same CGEvent
// input as .github/qa/gkwin.swift on qa/install-matrix). Built on the runner: swiftc -O -o mouse mouse.swift
//   mouse frame <owner>               "x y w h" of that owner's largest on-screen window (screen points), exit 1 if none
//   mouse click <x> <y> <n>           n clicks at x,y as one multi-click (n = 3 selects a line in Terminal)
//   mouse drag <x1> <y1> <x2> <y2>    press at x1,y1, move there in 24 steps to x2,y2, release
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

func post(_ type: CGEventType, _ p: CGPoint, clicks: Int64 = 1) {
  guard let e = CGEvent(mouseEventSource: nil, mouseType: type, mouseCursorPosition: p, mouseButton: .left) else { exit(3) }
  e.setIntegerValueField(.mouseEventClickState, value: clicks)
  e.post(tap: .cghidEventTap)
}

let a = CommandLine.arguments
guard a.count > 1 else { exit(2) }
switch a[1] {
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
  usleep(120_000)
  post(.leftMouseDown, p1)
  usleep(80_000)
  for i in 1...24 {
    let t = Double(i) / 24
    post(.leftMouseDragged, CGPoint(x: p1.x + (p2.x - p1.x) * t, y: p1.y + (p2.y - p1.y) * t))
    usleep(20_000)
  }
  post(.leftMouseUp, p2)
default:
  exit(2)
}
