// QA helper for qa-gatekeeper-proof.yml: on-screen windows, one owner's window id and bounds, and scroll-wheel input.
//   gkwin list                         id, owner, title, layer, origin, size of every on-screen window
//   gkwin find <owner>                 "id x y w h" of that owner's largest on-screen window (exit 1 if none)
//   gkwin scroll <x> <y> <lines> <n>   moves the pointer to x,y (screen points) and sends n wheel ticks of <lines>
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

func owner(_ w: [String: Any]) -> String { w[kCGWindowOwnerName as String] as? String ?? "?" }
func number(_ w: [String: Any]) -> Int { w[kCGWindowNumber as String] as? Int ?? 0 }

let a = CommandLine.arguments
guard a.count > 1 else { exit(2) }
switch a[1] {
case "list":
  for w in onScreen() {
    let r = frame(w)
    let title = w[kCGWindowName as String] as? String ?? ""
    let layer = w[kCGWindowLayer as String] as? Int ?? 0
    print("\(number(w))\t\(owner(w))\t\(title)\tlayer=\(layer)\t\(Int(r.minX)),\(Int(r.minY))\t\(Int(r.width))x\(Int(r.height))")
  }
case "find" where a.count > 2:
  let hits = onScreen().filter { owner($0) == a[2] }.sorted { frame($0).width * frame($0).height > frame($1).width * frame($1).height }
  guard let w = hits.first else { exit(1) }
  let r = frame(w)
  print("\(number(w)) \(Int(r.minX)) \(Int(r.minY)) \(Int(r.width)) \(Int(r.height))")
case "scroll" where a.count > 5:
  let p = CGPoint(x: Double(a[2]) ?? 0, y: Double(a[3]) ?? 0)
  CGWarpMouseCursorPosition(p)
  CGEvent(mouseEventSource: nil, mouseType: .mouseMoved, mouseCursorPosition: p, mouseButton: .left)?.post(tap: .cghidEventTap)
  usleep(150_000)
  for _ in 0..<(Int(a[5]) ?? 1) {
    CGEvent(scrollWheelEvent2Source: nil, units: .line, wheelCount: 1, wheel1: Int32(a[4]) ?? -3, wheel2: 0, wheel3: 0)?.post(tap: .cghidEventTap)
    usleep(80_000)
  }
default:
  exit(2)
}
