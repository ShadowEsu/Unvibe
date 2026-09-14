# Approved Unvibe app baseline

The user explicitly identified the Newsreader/Golden Gate version as the app to
improve on September 13, 2026. This supersedes the earlier assumption that the
application on the latest main commit was the approved visual design.

## Source

- App v0.1.11: `origin/unvibe-studio-redesign`, commit `cdaa4fd`.
- Authoritative local copy: `Unvibe/Unvibe` relative to the original workspace.
- Preserve its local changes to `widget.tsx` and `widget.css`: the San Francisco
  backdrop and refined widget logo/appearance.
- Include the matching desktop bridge, custom URL handler and packaged assets.
- User reference set: `Desktop/Unvibe Resources/new app`, August 17–18 screenshots.

## Protect

Newsreader serif typography; JetBrains Mono; Golden Gate background imagery;
coral, blue and purple translucent surfaces; separate Home, Learn, History, Quiz,
Chat, Progress, Plan and Gift pages; AI/selection usage meters; existing Island
learning pulse and explanation widgets. Preserve the current optional light theme.

The previous DM Sans app at main commit `9df8e45` is rejected as the design baseline.
Do not take its renderer files or CSS as a starting point, even if its commit date
is newer. Feedback implementation from the wrong baseline remains isolated and
must be reconsidered against this source one change at a time.

## Scope of baseline correction

This change establishes the user's approved app and matching desktop bridge in main.
Marketing, backend, existing deployments and installed copies are not replaced.
The application source/package version stays 0.1.11; this is not a new binary release.
Branch-specific features from the superseded app are not proof of compatibility
or a reason to silently replace the approved renderer. Audit backend contracts and
bring necessary functional fixes forward explicitly before shipping a new binary.

## Subsequent implementation

First verify this app's runtime, Windows capture and release configuration. Then
add the requested small sidebar toggle/search interactions inside this design.
Reproduce feedback against this baseline; do not recreate already working features.
Use same-view before/after captures for every visual patch. Do not edit marketing.

The earlier private feedback planner contains an incorrect visual-baseline assumption;
its customer reports remain useful, but its DM Sans preservation instructions are
superseded by this document and the user's explicit screenshots.
