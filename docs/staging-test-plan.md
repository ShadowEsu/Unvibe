# Staging test plan

Run only after the environment checklist is complete. Use two disposable staging identities and
record masked IDs, timestamps, and request outcomes.

Start with `docs/release/staging-setup.md` and the guarded `npm run verify:staging` command. The
steps below extend the automated database/deletion checks with packaged-app and provider behavior.

1. Apply migrations; verify all user-owned tables and RLS policies with user A, user B, and anon.
2. Complete verified device login, restart the packaged app, and confirm encrypted session restore.
   Verify device-code lifecycle on staging: a second approval of the same code does not mint a new
   token, redemption is one-time (a repeat redeem returns 409), and an 11+ minute-old code cannot be
   approved (returns 404/410 per the auth token route). Verify an opaque session 30+ days old is
   rejected by `/api/v1/account` (401).
3. Generate a real streamed explanation, cancel one, complete a quiz, and verify mock is false.
4. Record events online, offline, then after reconnect; inspect event IDs remotely for exactly-once
   upserts. Test midnight and timezone boundaries with controlled clocks.
5. Delete the account and verify the old token returns 401, records are absent, and local store is
   empty. Recreate the account and confirm no history returns.
6. Repeat from `app/release/mac-arm64/Unvibe.app` with an external display and macOS Accessibility.
