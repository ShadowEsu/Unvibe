# Offline and restart test

Use a disposable macOS account or back up `~/Library/Application Support/Unvibe` first.

1. Launch a packaged app while signed in; record one synthetic learning event and confirm sync.
2. Disable network access. Record at least three more events and change an outcome. Confirm “Saved on this Mac,” a nonzero pending count, and no blocking spinner.
3. Quit normally, relaunch offline, and confirm events, outcomes, account identity, and pending count survive.
4. Force-quit during a later local save, relaunch, and confirm the JSON store is readable and contains either the previous or new complete state, never partial JSON.
5. Restore the network. Confirm bounded retry or manual retry uploads the outbox once, then downloads all cursor pages.
6. Restart again and confirm no duplicate events, no lost pending records, and a current “Synced” timestamp.
7. Expire/revoke the session and repeat reconnect. Confirm `auth_required`; the outbox remains account-bound and is not uploaded to a different account.

Capture before/offline/after event IDs and screenshots. Pass requires local continuity, durable outbox recovery, idempotent reconciliation, and no cross-account upload.
