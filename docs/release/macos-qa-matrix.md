# macOS QA matrix

Record OS build, hardware, artifact checksum, tester, and date for each row.

| Area | Required cases | Pass condition |
| --- | --- | --- |
| Hardware | Apple silicon baseline; Intel only if a universal build is approved | Supported architecture launches; unsupported builds are labeled |
| OS | Oldest supported macOS, current macOS, current beta only as informational | Install, launch, permission, update/uninstall paths behave |
| Permissions | Accessibility denied, granted, revoked while running | Clear guidance; no crash or silent capture |
| Editor | VS Code and Cursor active; unsupported app active | Selected code works in supported apps; unsupported state is honest |
| Windowing | One/two displays, Spaces, full screen, different scale factors | Bar/widget remain reachable and movable |
| Network | Online, offline, DNS failure, slow link, 401, 429, 5xx | Local work continues; retry/error state is accurate |
| Lifecycle | First launch, normal quit, force quit, restart, logout/login | No corrupt store, duplicate event, or lost outbox |
| Accessibility | Keyboard-only, VoiceOver, Reduce Motion, high contrast | Core loop and account deletion are operable |
| Packaging | DMG checksum, drag install, Gatekeeper, notarization staple | All release evidence is valid |

Any crash, data loss, secret exposure, cross-user access, broken deletion, or misleading provider state is release-blocking.
