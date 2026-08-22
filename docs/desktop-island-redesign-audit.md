# Unvibe desktop island redesign — audit and implementation plan

Date: 2026-07-22

## Decision

Keep the Electron architecture for this release. The application already has a
secure main-process boundary for capture, secret filtering, storage, and all
network I/O, plus separate transparent windows for the small learning strip,
explanation widget, and companion app. Replacing it with a Swift/AppKit helper
would be a major architecture change: it would duplicate capture, settings,
storage, and IPC work, add an unsigned native binary to the packaging surface,
and put the private-beta release at risk. It needs a separate approved proposal.

Instead, create an Electron-native `IslandStateStore` and
`IslandPresentationResolver` in the main process. The renderer remains a pure
view of the resolved state; it does not resize windows directly.

## Existing architecture

### Windows and overlay

- `app/src/main/windows.ts` creates a 196 × 44 transparent, non-focusable bar
  and expands it to 410 × 132 on hover. It follows the pointer display and is
  visible above full-screen spaces.
- The bar renderer is `app/src/renderer/bar/bar.tsx`. It is currently a
  persistent status strip with a hover drawer, not a state-driven island.
- `buildWidgetWindow` creates the separate transparent explanation card. It is
  movable, resizable through renderer grips, pinnable, and supports inactive
  dim/collapse behavior.
- `main.ts` already restores both floating surfaces on display changes.

### Capture and explanation flow

- Capture, secret filtering, project context construction, review streaming,
  and error mapping live in the Electron main process. The sandboxed renderers
  cannot make remote requests.
- `review.ts` sends `review:event` messages to the explanation widget. Progress
  is currently represented by a few string statuses rather than a single typed
  island product state.
- The widget already supports a depth selection, streaming response, follow-up,
  save/understood, quiz, pin, and collapse paths.

### Settings, onboarding, and messages

- `settings.ts` persists launch-at-login, theme, shortcut, visibility, display
  following, sounds, idle behavior, depth, notifications, and quiet hours.
- Settings and onboarding are React views inside the companion BrowserWindow.
  Onboarding is a four-step demo plus the real Accessibility request. It is not
  full-screen or independently coordinated yet.
- `notify.ts` is a rate-limited string message sent to the bar. There is no
  category model, durable notification center, or action routing.
- The tray menu has only Review selection, Open Unvibe, and Quit.

## Reusable pieces

- `settings.ts` for durable preferences and side effects.
- `windows.ts` for display routing, workspace behavior, and transparent-window
  lifecycle.
- `review.ts` and the existing event protocol for truthful progress states.
- `widget.tsx` for the detailed explanation card, actions, and keyboard flow.
- `LogoMark`, the existing purple visual system, and the local Web Audio setup
  tone as original Unvibe foundations.

## Gaps to close

1. No typed island product/presentation state model.
2. Window geometry is driven by one boolean hover path, not a central resolver.
3. No island context menu; the tray menu is incomplete.
4. Onboarding duplicates a mock strip and lives inside the companion window.
5. Notification messages are transient strings, cannot be archived, and do not
   map to a related explanation or setting.
6. The bar does not handle keyboard depth selection or reduced-motion geometry
   in a system-wide, testable way.
7. The current `BrowserWindow` can approximate a non-activating overlay, but
   cannot provide AppKit's exact `NSPanel` hit testing and notch geometry.

## Focused migration plan

### Phase 2 — island foundation

Add main-process modules:

```
main/island/state.ts          typed product states and events
main/island/presentation.ts   state → hidden/dormant/micro/compact/expanded/fullCard
main/island/controller.ts     owns the bar, geometry, focusability, and display routing
main/island/menu.ts           shared tray/island context-menu templates
```

Start with `idle`, `selectionDetected`, `choosingDepth`, `capturingContext`,
`generating`, `streaming`, `explanationReady`, `saved`, `offline`,
`permissionRequired`, and `serviceError`. Use only real events from capture and
streaming; do not claim project-context work that did not occur.

The renderer receives one immutable state snapshot. It uses CSS transitions for
small opacity/blur changes and a `prefers-reduced-motion` path that removes
translation/spring-like transforms. The main controller owns size and position.

### Phase 3 — explanation integration

Map capture and review events to the typed state store. Add a keyboard-operable
depth selector (`⌘1`, `⌘2`, `⌘3`, arrows, Return, Escape). Keep long content in
the existing widget; the island shows a truthful compact completion and actions.

### Phase 4 — onboarding

First refactor the existing onboarding into a reusable scene model that drives
the production island with controlled demo data. Then introduce a full-screen
Electron onboarding window and a separate demo-window layer. This keeps the
same island renderer in product and demo paths. Accessibility remains requested
only after the user sees why it is needed.

### Phase 5 — settings

Keep the companion settings surface for the beta. Expand only controls with
real backing behavior (island density, auto-collapse, motion, sound,
completion dwell, default depth, notification categories). Do not add decorative
switches. A true native AppKit settings window remains a post-beta architecture
decision.

### Phase 6 — messages and milestones

Add a local durable notification store with `new` and `archived` states,
categories, action targets, and per-category settings. Milestones must be
derived from real learning events. Referral or reward messages stay disabled
until server-side verification exists.

## Risks and test matrix

- **Focus/click-through:** Electron transparent windows may require a small
  platform-specific `setIgnoreMouseEvents` experiment to make dormant areas
  transparent without breaking compact controls.
- **Notch geometry:** Electron exposes work areas, not a public physical-notch
  rectangle. Use top-center positioning with a notch-safe visual shape; external
  displays receive the same compact pill.
- **Mission Control, Spaces, sleep/wake, screen sharing:** preserve existing
  workspace restoration and add explicit manual QA before release.
- **Accessibility:** no changes may bypass the existing local secret filter or
  main-process capture boundary.

Required validation: notch and non-notch Macs; external and multiple displays;
display disconnection; Mission Control; full-screen apps; sleep/wake; Focus and
quiet hours; reduced motion; keyboard-only state changes; offline, permission,
and stream-failure recovery.

## Reference-asset note

The supplied attachment set contains the design brief and one unrelated form
screenshot. No Vibe Island ZIP or product screenshot was available locally, so
no supplied bundle assets were inspected or reused.
