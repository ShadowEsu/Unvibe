// QA helper for two-app-take.mjs, rc-0154.mjs, setup-0157.mjs and d5-button.mjs (macOS runner): an app's window frame,
// the on-screen windows, the main display's mode, and real mouse input (the same CGEvent input as
// .github/qa/gkwin.swift on qa/install-matrix). Built on the runner: swiftc -O -o mouse mouse.swift
//   mouse frame <owner>               "x y w h" of that owner's largest on-screen window (screen points), exit 1 if none
//   mouse list                        every on-screen window, front to back: "<pid>\t<owner>\t<layer>\t<x> <y> <w> <h>"
//   mouse display <w> <h>             the main display to its smallest mode of at least w x h points (public
//                                     CoreGraphics API); prints the modes and the result
//   mouse click <x> <y> <n>           n clicks at x,y as one multi-click (n = 3 selects a line in Terminal); prints the
//                                     cursor before the first press and 40 ms into it ("press: … at40: …")
//   mouse drag <x1> <y1> <x2> <y2>    a settle on x1,y1 (three small real moves, then 300 ms, so the app under it sets
//                                     its cursor), press, move there in 24 steps (each with its delta) to x2,y2,
//                                     release; prints the cursor at the press and 40 ms after it ("press: … at40: …"),
//                                     then the release time (ms since 1970) once it is posted
//   mouse race <x0> <y0> <x1> <y1> <x2> <y2>
//                                     a settle on x0,y0, then a move to x1,y1 and a press at once, 24 steps to x2,y2,
//                                     release; prints "rest: … gap=<ms> at40: …" (the cursor at rest and 40 ms after
//                                     the press, the ms between the move and the press), then the release time
//   mouse move <x> <y>                the pointer to x,y (a real move event), no button
//   mouse activations <seconds>       for that long, one line per NSWorkspace didActivateApplication note:
//                                     "<userInfo key>\t<value's description>" (#378 reads the pid in "(bundle id - pid)")
// For d5-button.mjs's auto-mode launches (#384):
//   mouse key <action>                one key action now, as real key events: paste (⌘V), switch (⌘Tab: ⌘ held, Tab,
//                                     ⌘ released), copy (⌘C), type:<ascii> (each character typed); prints the time
//   mouse dragkey <x1> <y1> <x2> <y2> <ms> <action>
//                                     a drag as `drag`, then <ms> after the release the key action; prints the press
//                                     reads, then "up=<release ms> key=<ms the key action began> done=<ms it ended>"
//                                     (ms since 1970). Also se-paste (⌘V) and se-type:<ascii>: the same keys sent
//                                     through System Events (compiled and System Events warmed before the drag)
//   mouse front                       the frontmost app's bundle id
//   mouse clip info                   the general pasteboard: change count, types, the PNG's sha256, file URLs, and
//                                     the text's length and first 80 characters, as one JSON line
//   mouse clip image <png>            the pasteboard holds that PNG only (as a screenshot copy does)
//   mouse clip files <path>           the pasteboard holds that file as a file URL (NSURL, the way Finder copies one)
//   mouse clipwatch                   until stdin closes: every 5 ms the change count; on a change one JSON line
//                                     {t, c, types, len, text (first 400 characters)}
import AppKit
import Carbon
import CoreGraphics
import CryptoKit
import Foundation

func nowMs() -> Int64 { Int64(Date().timeIntervalSince1970 * 1000) }

/// Key events at the HID tap, as a keyboard's (auto-mode rows): the app in front gets them.
let keySource = CGEventSource(stateID: .hidSystemState)
func key(_ code: CGKeyCode, _ down: Bool, _ flags: CGEventFlags = []) {
  guard let e = CGEvent(keyboardEventSource: keySource, virtualKey: code, keyDown: down) else { exit(3) }
  e.flags = flags
  e.post(tap: .cghidEventTap)
}
/// paste (⌘V), copy (⌘C), switch (⌘ held, Tab, ⌘ released: the app switcher's choice, the last app), type:<ascii>.
func act(_ a: String) {
  switch a {
  case "paste", "copy":
    let k: CGKeyCode = a == "paste" ? 9 : 8
    key(55, true, .maskCommand); usleep(20_000)
    key(k, true, .maskCommand); key(k, false, .maskCommand); usleep(20_000)
    key(55, false)
  case "switch":
    key(55, true, .maskCommand); usleep(40_000)
    key(48, true, .maskCommand); key(48, false, .maskCommand); usleep(200_000)
    key(55, false)
  default:
    guard a.hasPrefix("type:") else { exit(2) }
    for unit in a.dropFirst(5).utf16 {
      var c: UniChar = unit
      guard let d = CGEvent(keyboardEventSource: keySource, virtualKey: 0, keyDown: true),
            let u = CGEvent(keyboardEventSource: keySource, virtualKey: 0, keyDown: false) else { exit(3) }
      d.keyboardSetUnicodeString(stringLength: 1, unicodeString: &c)
      u.keyboardSetUnicodeString(stringLength: 1, unicodeString: &c)
      d.post(tap: .cghidEventTap)
      u.post(tap: .cghidEventTap)
      usleep(15_000)
    }
  }
}

/// se-paste and se-type:<ascii>: the keys through System Events, as an Apple event it turns into key events. Unlike the
/// CGEvent posts above they reset IOHIDSystem's HIDIdleTime, which auto mode's Mac idle check reads (run 44987639357:
/// with CGEvent keys every Mac row still read, even a paste before the 700 ms; System Events' own ⌘C resets it, run
/// 44982193648). Compiled, and System Events asked something harmless, before the drag, so the key goes at once.
func seScript(_ a: String) -> NSAppleScript? {
  let body: String
  if a == "se-paste" { body = "keystroke \"v\" using command down" }
  else if a.hasPrefix("se-type:") { body = "keystroke \"\(a.dropFirst(8))\"" }
  else { return nil }
  var err: NSDictionary?
  guard let warm = NSAppleScript(source: "tell application \"System Events\" to get name"),
        let s = NSAppleScript(source: "tell application \"System Events\" to \(body)") else { exit(4) }
  _ = warm.executeAndReturnError(&err)
  if err == nil { _ = s.compileAndReturnError(&err) }
  if let e = err { FileHandle.standardError.write("System Events: \(e)\n".data(using: .utf8)!); exit(4) }
  return s
}
func runSE(_ s: NSAppleScript) {
  var err: NSDictionary?
  _ = s.executeAndReturnError(&err)
  if let e = err { FileHandle.standardError.write("System Events: \(e)\n".data(using: .utf8)!); exit(4) }
}

/// The general pasteboard as one JSON object: change count, types, the PNG's sha256, file URLs, the text's length and
/// its first `keep` characters.
func clipState(_ keep: Int) -> [String: Any] {
  let pb = NSPasteboard.general
  var o: [String: Any] = ["t": nowMs(), "c": pb.changeCount, "types": (pb.types ?? []).map { $0.rawValue }]
  if let png = pb.data(forType: .png) { o["png"] = SHA256.hash(data: png).map { String(format: "%02x", $0) }.joined() }
  if let urls = pb.readObjects(forClasses: [NSURL.self], options: [.urlReadingFileURLsOnly: true]) as? [URL], !urls.isEmpty {
    o["files"] = urls.map { $0.path }
  }
  let s = pb.string(forType: .string) ?? ""
  o["len"] = s.count
  o["text"] = String(s.prefix(keep))
  return o
}
func printJSON(_ o: [String: Any]) {
  guard let d = try? JSONSerialization.data(withJSONObject: o), let s = String(data: d, encoding: .utf8) else { return }
  print(s)
  fflush(stdout)
}

/// The system cursor as the Mac helper reads it (selection-watch/mac/main.swift: NSCursor.currentSystem's hot spot
/// against NSCursor.iBeam's), with both images' sizes (lead 2026-11-20, after run 44675654106 read hot=12,11 on text),
/// and secure input (the helper shows nothing while it's on).
func pt(_ x: CGFloat, _ y: CGFloat) -> String { String(format: "%g,%g", Double(x), Double(y)) }
func cur() -> String {
  let secure = IsSecureEventInputEnabled() ? 1 : 0
  let ib = NSCursor.iBeam
  let ibeam = "ibeam=\(pt(ib.hotSpot.x, ib.hotSpot.y)) ibeamsize=\(String(format: "%gx%g", Double(ib.image.size.width), Double(ib.image.size.height)))"
  guard let c = NSCursor.currentSystem else { return "cur=none \(ibeam) secure=\(secure)" }
  let beam = c.hotSpot == ib.hotSpot ? 1 : 0
  return "hot=\(pt(c.hotSpot.x, c.hotSpot.y)) size=\(String(format: "%gx%g", Double(c.image.size.width), Double(c.image.size.height))) \(ibeam) beam=\(beam) secure=\(secure)"
}

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

/// Three small real moves onto p, then 300 ms: the app under the pointer has set its cursor before the press
/// (unvibe-app, run 44668914881 read).
func settle(_ p: CGPoint) {
  for x in [p.x - 2, p.x + 2, p.x] {
    let q = CGPoint(x: x, y: p.y)
    CGWarpMouseCursorPosition(q)
    post(.mouseMoved, q)
    usleep(60_000)
  }
  usleep(300_000)
}

/// A held button moved from p1 to p2 in 24 steps of 20 ms, each with its delta.
func steps(_ p1: CGPoint, _ p2: CGPoint) {
  var last = p1
  for i in 1...24 {
    let t = Double(i) / 24
    let p = CGPoint(x: (p1.x + (p2.x - p1.x) * t).rounded(), y: (p1.y + (p2.y - p1.y) * t).rounded())
    post(.leftMouseDragged, p, dx: Int64(p.x - last.x), dy: Int64(p.y - last.y))
    last = p
    usleep(20_000)
  }
}

// AppKit up (no Dock icon, never activated): without it NSCursor.iBeam read as hot 0,0, 0×0 in this command-line tool
// (run 44677798585), so the harness's own beam= compared against an empty cursor. The helper's beamref read 12,11 23×22.
_ = NSApplication.shared
NSApp.setActivationPolicy(.prohibited)
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
  // A permanent configuration. In run 44664920831 CGDisplaySetDisplayMode returned 0 and read 1280x960, but the next
  // screencapture and Unvibe's screen were 1024x768: [INFERENCE] its change lasted only while this process ran.
  var result = "no mode of at least \(wantW)x\(wantH)"
  if let m = fit {
    var config: CGDisplayConfigRef?
    let begin = CGBeginDisplayConfiguration(&config)
    let set = CGConfigureDisplayWithDisplayMode(config, main, m, nil)
    let done = CGCompleteDisplayConfiguration(config, .permanently)
    result = "\(m.width)x\(m.height): begin \(begin.rawValue), configure \(set.rawValue), complete permanently \(done.rawValue)"
  }
  usleep(1_500_000)
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
  // A real move first, so the app under the pointer sets its cursor (the I-beam over text) before the press.
  post(.mouseMoved, p)
  usleep(150_000)
  let before = cur()
  var at40 = ""
  for i in 1...max(1, Int(a[4]) ?? 1) {
    post(.leftMouseDown, p, clicks: Int64(i))
    if i == 1 { usleep(40_000); at40 = cur() } else { usleep(30_000) }
    post(.leftMouseUp, p, clicks: Int64(i))
    usleep(60_000)
  }
  print("press: \(before) at40: \(at40)")
case "drag" where a.count > 5:
  let p1 = CGPoint(x: Double(a[2]) ?? 0, y: Double(a[3]) ?? 0)
  let p2 = CGPoint(x: Double(a[4]) ?? 0, y: Double(a[5]) ?? 0)
  settle(p1)
  let before = cur()
  post(.leftMouseDown, p1)
  usleep(40_000)
  let at40 = cur()
  usleep(40_000)
  steps(p1, p2)
  post(.leftMouseUp, p2)
  print("press: \(before) at40: \(at40)")
  print(Int64(Date().timeIntervalSince1970 * 1000))
case "race" where a.count > 7:
  let p0 = CGPoint(x: Double(a[2]) ?? 0, y: Double(a[3]) ?? 0)
  let p1 = CGPoint(x: Double(a[4]) ?? 0, y: Double(a[5]) ?? 0)
  let p2 = CGPoint(x: Double(a[6]) ?? 0, y: Double(a[7]) ?? 0)
  settle(p0)
  let rest = cur()
  let t0 = DispatchTime.now().uptimeNanoseconds
  CGWarpMouseCursorPosition(p1)
  post(.mouseMoved, p1, dx: Int64(p1.x - p0.x), dy: Int64(p1.y - p0.y))
  post(.leftMouseDown, p1)
  let gap = Double(DispatchTime.now().uptimeNanoseconds - t0) / 1_000_000
  usleep(40_000)
  let at40 = cur()
  usleep(40_000)
  steps(p1, p2)
  post(.leftMouseUp, p2)
  print("rest: \(rest) gap=\((gap * 10).rounded() / 10) at40: \(at40)")
  print(Int64(Date().timeIntervalSince1970 * 1000))
case "list":
  // CGWindowList's own order: front to back.
  for w in onScreen() {
    let r = frame(w)
    let pid = w[kCGWindowOwnerPID as String] as? Int ?? 0
    let owner = w[kCGWindowOwnerName as String] as? String ?? "?"
    let layer = w[kCGWindowLayer as String] as? Int ?? 0
    print("\(pid)\t\(owner)\t\(layer)\t\(Int(r.minX)) \(Int(r.minY)) \(Int(r.width)) \(Int(r.height))")
  }
case "move" where a.count > 3:
  let p = CGPoint(x: Double(a[2]) ?? 0, y: Double(a[3]) ?? 0)
  CGWarpMouseCursorPosition(p)
  post(.mouseMoved, p)
case "activations" where a.count > 2:
  // NSWorkspace's own notification center needs a run loop; each note's userInfo printed as it is (lead, #378).
  let center = NSWorkspace.shared.notificationCenter
  let token = center.addObserver(forName: NSWorkspace.didActivateApplicationNotification, object: nil, queue: nil) { note in
    for (key, value) in note.userInfo ?? [:] { print("\(key.base)\t\(value)"); fflush(stdout) }
  }
  RunLoop.main.run(until: Date(timeIntervalSinceNow: Double(a[2]) ?? 5))
  center.removeObserver(token)
case "key" where a.count > 2:
  act(a[2])
  print(nowMs())
case "dragkey" where a.count > 7:
  // The drag as `drag`, then the key action <ms> after the release, timed here (no process start in between).
  let p1 = CGPoint(x: Double(a[2]) ?? 0, y: Double(a[3]) ?? 0)
  let p2 = CGPoint(x: Double(a[4]) ?? 0, y: Double(a[5]) ?? 0)
  let se = seScript(a[7])
  settle(p1)
  let before = cur()
  post(.leftMouseDown, p1)
  usleep(40_000)
  let at40 = cur()
  usleep(40_000)
  steps(p1, p2)
  post(.leftMouseUp, p2)
  let up = nowMs()
  let due = up + (Int64(a[6]) ?? 0)
  while nowMs() < due { usleep(2_000) }
  let k = nowMs()
  if let s = se { runSE(s) } else { act(a[7]) }
  print("press: \(before) at40: \(at40)")
  print("up=\(up) key=\(k) done=\(nowMs())")
case "front":
  print(NSWorkspace.shared.frontmostApplication?.bundleIdentifier ?? "none")
case "clip" where a.count > 2:
  let pb = NSPasteboard.general
  switch a[2] {
  case "info":
    printJSON(clipState(80))
  case "image" where a.count > 3:
    guard let png = FileManager.default.contents(atPath: a[3]) else { exit(1) }
    pb.clearContents()
    pb.setData(png, forType: .png)
    printJSON(clipState(80))
  case "files" where a.count > 3:
    pb.clearContents()
    pb.writeObjects([NSURL(fileURLWithPath: a[3])])
    printJSON(clipState(80))
  default:
    exit(2)
  }
case "clipwatch":
  // Every 5 ms the change count (an IPC read, nothing held); one line per change, until stdin closes.
  DispatchQueue.global().async {
    while readLine() != nil {}
    exit(0)
  }
  var last = NSPasteboard.general.changeCount
  var first = clipState(400)
  first["start"] = 1
  printJSON(first)
  while true {
    usleep(5_000)
    let c = NSPasteboard.general.changeCount
    if c != last {
      last = c
      printJSON(clipState(400))
    }
  }
default:
  exit(2)
}
