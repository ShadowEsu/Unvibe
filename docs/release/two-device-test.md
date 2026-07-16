# Two-device sync test

Prerequisite: staging gate green; two Macs or two isolated macOS user accounts; synthetic code only.

1. Sign the same disposable account into Device A and Device B through separate device-code flows. Confirm each device code can be redeemed once only.
2. On A create 650+ synthetic historical events (or use the approved seed fixture); sync. On B restore and confirm every ID arrives across multiple pages.
3. Take B offline. Create events on both devices, including two updates to different event IDs. Reconnect B in a throttled/unstable network.
4. Confirm all unique IDs converge, duplicates do not appear, pending local changes are not overwritten by older remote copies, and pages make visible progress.
5. Sign B out and into a different disposable account. Confirm A's queued data does not upload to the new account.
6. Delete the first account and confirm both devices receive authentication failure; verify backend rows and sessions are gone.

Save event-count/ID diffs from both devices. Pass means counts and IDs converge, the former 500-record ceiling is exceeded safely, and identity boundaries hold.
