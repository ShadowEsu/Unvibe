# Staging test plan

Run only after the environment checklist is complete. Use two disposable staging identities and
record masked IDs, timestamps, and request outcomes.

1. Apply migrations; verify all user-owned tables and RLS policies with user A, user B, and anon.
2. Complete verified device login, restart the packaged app, and confirm encrypted session restore.
3. Generate a real streamed explanation, cancel one, complete a quiz, and verify mock is false.
4. Record events online, offline, then after reconnect; inspect event IDs remotely for exactly-once
   upserts. Test midnight and timezone boundaries with controlled clocks.
5. Delete the account and verify the old token returns 401, records are absent, and local store is
   empty. Recreate the account and confirm no history returns.
6. Repeat from `app/release/mac-arm64/Unvibe.app` with an external display and macOS Accessibility.
