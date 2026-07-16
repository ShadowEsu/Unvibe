# Tester troubleshooting

| Symptom | Safe action | Escalate when |
| --- | --- | --- |
| Shortcut does nothing | Confirm VS Code/Cursor is frontmost; check Accessibility permission; relaunch | Permission is granted and packaged build still fails |
| “Saved on this Mac” | Continue locally; restore network; choose Retry sync | Pending count never falls after stable network |
| “Sign in again” | Sign in to the same account | Events appear under another account or outbox disappears |
| No explanation/stream stops | Retry once; preserve sanitized timestamp and result class | Repeated 401/429/5xx, malformed output, or source appears in logs |
| Widget off-screen | Reopen companion/floating bar; change display arrangement back | Widget remains unreachable by keyboard/pointer |
| App will not open | Verify checksum and Gatekeeper/notarization result; reinstall approved artifact | Signature warning, crash loop, or altered checksum |
| Learning missing after restart | Stop using the app; copy the Application Support folder without opening its content | Any suspected data loss/corruption |
| Delete account fails | Retry on stable network; do not assume deletion happened | No success confirmation or later sign-in still exposes data |

Never solve a beta issue by disabling OS security, sharing tokens/keys, editing production data, deleting local stores before backup, or installing an unsigned replacement from an unapproved channel.
