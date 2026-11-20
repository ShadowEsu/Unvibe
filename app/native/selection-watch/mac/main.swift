// Unvibe's selection helper for macOS (D5, the Unvibe button).
//
// It watches the mouse only, never the keyboard (Security G3): a global monitor for left-button down/up, right
// click and scroll, plus which app is in front. It reads no text from any app and sets nothing on other apps
// (FEASIBILITY §1). One JSON object per line goes to stdout for Unvibe's main process; nothing goes to a file, a
// socket or stderr (Security H1, H2). It exits when Unvibe closes its stdin.
//
// Events (app/src/core/bubble.ts parseHelperLine is the contract):
//   {"e":"ready","v":1}
//   {"e":"select","x":..,"y":..,"px":..,"py":..,"app":"<bundle id>","g":"drag|double|triple"}
//        a mouse selection ended over text: x/y its end, px/py where the pointer rests
//   {"e":"down"|"right"|"scroll","x":..,"y":..}                                  so the button can leave
//   {"e":"app","app":"<bundle id>"}                                              another app came to the front
// Points are global, in points, with the origin at the top-left of the primary screen (Electron's screen space).

import AppKit
import Carbon.HIToolbox

setvbuf(stdout, nil, _IOLBF, 0)

func emit(_ object: [String: Any]) {
    guard JSONSerialization.isValidJSONObject(object),
          let data = try? JSONSerialization.data(withJSONObject: object),
          let line = String(data: data, encoding: .utf8) else { return }
    FileHandle.standardOutput.write((line + "\n").data(using: .utf8)!)
}

/// Cocoa's global space starts at the primary screen's bottom-left; Electron's at its top-left.
func topLeft(_ p: NSPoint) -> NSPoint {
    let height = NSScreen.screens.first?.frame.height ?? 0
    return NSPoint(x: p.x, y: height - p.y)
}

func frontmostBundle() -> String {
    NSWorkspace.shared.frontmostApplication?.bundleIdentifier ?? ""
}

/// The pointer is the text I-beam: the press starts in text, not on a tab, a scrollbar or a sidebar. Told apart by
/// the cursor's hot spot. When macOS can't say, it counts as text, so the editors list alone decides.
let beamHotSpot = NSCursor.iBeam.hotSpot
func pointerIsBeam() -> Bool {
    guard let current = NSCursor.currentSystem else { return true }
    return current.hotSpot == beamHotSpot
}

func round1(_ v: CGFloat) -> Double { (Double(v) * 10).rounded() / 10 }

var downAt: NSPoint? = nil
var downOverText = false
var lastScroll = Date.distantPast

let mask: NSEvent.EventTypeMask = [.leftMouseDown, .leftMouseUp, .rightMouseDown, .scrollWheel]
let monitor = NSEvent.addGlobalMonitorForEvents(matching: mask) { event in
    let at = topLeft(NSEvent.mouseLocation)
    switch event.type {
    case .leftMouseDown:
        downAt = at
        downOverText = pointerIsBeam()
        emit(["e": "down", "x": round1(at.x), "y": round1(at.y)])
    case .leftMouseUp:
        guard let start = downAt else { return }
        downAt = nil
        let moved = hypot(at.x - start.x, at.y - start.y)
        let gesture: String?
        if moved > 4 { gesture = "drag" }
        else if event.clickCount == 2 { gesture = "double" }
        else if event.clickCount >= 3 { gesture = "triple" }
        else { gesture = nil }
        // Never in secure input (a password field anywhere has it on) or when the press didn't start in text.
        guard let g = gesture, downOverText, !IsSecureEventInputEnabled() else { return }
        // A drag that went up, or left along one line, ends where it started: the selection's end is there.
        let upward = at.y < start.y - 4 || (abs(at.y - start.y) <= 4 && at.x < start.x)
        let end = g == "drag" && upward ? start : at
        emit(["e": "select", "x": round1(end.x), "y": round1(end.y), "px": round1(at.x), "py": round1(at.y), "app": frontmostBundle(), "g": g])
    case .rightMouseDown:
        emit(["e": "right", "x": round1(at.x), "y": round1(at.y)])
    case .scrollWheel:
        let now = Date()
        if now.timeIntervalSince(lastScroll) < 0.25 { return }
        lastScroll = now
        emit(["e": "scroll", "x": round1(at.x), "y": round1(at.y)])
    default:
        break
    }
}

NSWorkspace.shared.notificationCenter.addObserver(
    forName: NSWorkspace.didActivateApplicationNotification, object: nil, queue: .main
) { note in
    let app = note.userInfo?[NSWorkspace.applicationUserInfoKey] as? NSRunningApplication
    emit(["e": "app", "app": app?.bundleIdentifier ?? ""])
}

// Unvibe closing our stdin (or quitting) ends the helper.
DispatchQueue.global(qos: .utility).async {
    while readLine() != nil {}
    exit(0)
}

emit(["e": "ready", "v": 1])
let app = NSApplication.shared
app.setActivationPolicy(.prohibited)
_ = monitor
app.run()
