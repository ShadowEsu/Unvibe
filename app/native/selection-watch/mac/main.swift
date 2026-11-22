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
//   {"e":"press","x":..,"y":..,"mx":..,"my":..,"beam":0|1,"known":0|1,"secure":0|1,"cursor":{..}}
//        after each left press's I-beam read: what the helper saw, for QA's logs. Main drops it (no such event).
//   {"e":"beamref","cursor":{..}}   once at start: the I-beam the reads are compared with, for the same logs.
//        "cursor": {"hot":[x,y],"size":[w,h],"aspect":..,"rel":[x,y],"agree":..} (cursor geometry only)
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

/// A cursor's shape, the same at any display scale or Pointer size and whatever empty margin its image has: the
/// drawn ink's aspect, where the hot spot sits inside the ink (0..1 each way), and a coarse 6 × 12 mask of the ink.
struct Shape {
    let size: NSSize
    let hotSpot: NSPoint
    let aspect: Double
    let rel: (Double, Double)
    let mask: [Bool]
}

func shape(of cursor: NSCursor) -> Shape? {
    let size = cursor.image.size
    guard size.width >= 1, size.height >= 1 else { return nil }
    let scale: CGFloat = 4
    let w = Int((size.width * scale).rounded(.up)), h = Int((size.height * scale).rounded(.up))
    guard let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: w, pixelsHigh: h, bitsPerSample: 8,
                                     samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB,
                                     bytesPerRow: w * 4, bitsPerPixel: 32),
          let context = NSGraphicsContext(bitmapImageRep: rep) else { return nil }
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = context
    cursor.image.draw(in: NSRect(x: 0, y: 0, width: w, height: h))
    NSGraphicsContext.restoreGraphicsState()
    guard let data = rep.bitmapData else { return nil }
    // The bitmap's first row is the image's top, like the hot spot's origin.
    func ink(_ x: Int, _ y: Int) -> Bool { data[(y * w + x) * 4 + 3] > 64 }
    var minX = w, minY = h, maxX = -1, maxY = -1
    for y in 0..<h {
        for x in 0..<w where ink(x, y) {
            minX = min(minX, x); maxX = max(maxX, x); minY = min(minY, y); maxY = max(maxY, y)
        }
    }
    guard maxX >= minX, maxY >= minY else { return nil }
    let bw = maxX - minX + 1, bh = maxY - minY + 1
    let rel = ((Double(cursor.hotSpot.x * scale) - Double(minX)) / Double(bw),
               (Double(cursor.hotSpot.y * scale) - Double(minY)) / Double(bh))
    let cols = 6, rows = 12
    var mask: [Bool] = []
    for r in 0..<rows {
        for c in 0..<cols {
            let x0 = minX + c * bw / cols, x1 = max(minX + (c + 1) * bw / cols, x0 + 1)
            let y0 = minY + r * bh / rows, y1 = max(minY + (r + 1) * bh / rows, y0 + 1)
            var inked = 0, total = 0
            for y in y0..<min(y1, maxY + 1) {
                for x in x0..<min(x1, maxX + 1) {
                    total += 1
                    if ink(x, y) { inked += 1 }
                }
            }
            mask.append(total > 0 && inked * 3 >= total)
        }
    }
    return Shape(size: size, hotSpot: cursor.hotSpot, aspect: Double(bw) / Double(bh), rel: rel, mask: mask)
}

func agreement(_ a: Shape, _ b: Shape) -> Double {
    Double(zip(a.mask, b.mask).filter { $0 == $1 }.count) / Double(a.mask.count)
}

/// The same cursor as the I-beam: comparing raw hot spots failed on a real runner (VS Code's text cursor reported
/// (12, 11), NSCursor.iBeam another value), because the image, its margin and its scale differ between the two.
func sameShape(_ a: Shape, _ b: Shape) -> Bool {
    abs(a.aspect / b.aspect - 1) <= 0.25
        && abs(a.rel.0 - b.rel.0) <= 0.2 && abs(a.rel.1 - b.rel.1) <= 0.2
        && agreement(a, b) >= 0.85
}

func r2(_ v: Double) -> Double { (v * 100).rounded() / 100 }

func describe(_ s: Shape?, against ref: Shape?) -> [String: Any] {
    guard let s else { return ["none": 1] }
    var out: [String: Any] = [
        "hot": [Double(s.hotSpot.x), Double(s.hotSpot.y)], "size": [Double(s.size.width), Double(s.size.height)],
        "aspect": r2(s.aspect), "rel": [r2(s.rel.0), r2(s.rel.1)],
    ]
    if let ref { out["agree"] = r2(agreement(s, ref)) }
    return out
}

/// NSCursor.iBeam's shape, set once AppKit is up (below), before any event can arrive.
var beamShape: Shape? = nil

/// The pointer is the text I-beam: the press starts in text, not on a tab, a scrollbar or a sidebar. Told apart by
/// the cursor's shape. When macOS can't say (`known` false), it counts as text, so the editors list alone decides.
func readBeam() -> (beam: Bool, known: Bool, seen: Shape?) {
    guard let current = NSCursor.currentSystem else { return (true, false, nil) }
    guard let seen = shape(of: current), let beamShape else { return (current.hotSpot == NSCursor.iBeam.hotSpot, true, nil) }
    return (sameShape(seen, beamShape), true, seen)
}

/// How long after a press the I-beam is read. Editors (Chromium) set the cursor asynchronously, so at the press itself
/// it can still be the shape of where the pointer just was: a quick move-and-press would miss text or count the gutter
/// (SHOULD-D5-cursor). By now the editor's cursor for the press point has landed, and a drag keeps it.
let beamSettleMicros: useconds_t = 40_000

func round1(_ v: CGFloat) -> Double { (Double(v) * 10).rounded() / 10 }

var downAt: NSPoint? = nil
var downOverText = false
var lastScroll = Date.distantPast

let mask: NSEvent.EventTypeMask = [.leftMouseDown, .leftMouseUp, .rightMouseDown, .scrollWheel]
let monitor = NSEvent.addGlobalMonitorForEvents(matching: mask) { event in
    // Where the event happened, not where the pointer is by the time this runs (the handler can run late, and the
    // down's handler waits 40 ms). Quartz's event location is already top-left based, like Electron's screen space.
    let at = event.cgEvent?.location ?? topLeft(NSEvent.mouseLocation)
    switch event.type {
    case .leftMouseDown:
        downAt = at
        emit(["e": "down", "x": round1(at.x), "y": round1(at.y)])
        // Blocks this helper's own run loop only; the release that follows is handled after this read.
        usleep(beamSettleMicros)
        let read = readBeam()
        downOverText = read.beam
        let pointer = topLeft(NSEvent.mouseLocation)
        emit(["e": "press", "x": round1(at.x), "y": round1(at.y), "mx": round1(pointer.x), "my": round1(pointer.y),
              "beam": read.beam ? 1 : 0, "known": read.known ? 1 : 0, "secure": IsSecureEventInputEnabled() ? 1 : 0,
              "cursor": describe(read.seen, against: beamShape)])
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

let app = NSApplication.shared
app.setActivationPolicy(.prohibited)
beamShape = shape(of: NSCursor.iBeam)
emit(["e": "ready", "v": 1])
emit(["e": "beamref", "cursor": describe(beamShape, against: nil)])
_ = monitor
app.run()
