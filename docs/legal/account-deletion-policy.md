# Account Deletion Policy — DRAFT (requires attorney review)

_Last updated: [DATE]._

You can delete your account at any time from **Settings → Account → Delete my account**.

## What deletion does (as built)
1. Asks you to confirm, and explains what will be removed.
2. Calls the backend `DELETE /account` endpoint, which removes your user record, all your learning
   events, and revokes your authentication tokens.
3. Wipes your local learning store and account credentials on the device.
4. Returns the app to a clean, signed-out state.

After deletion, your previous authentication token no longer works (verified: subsequent
authenticated requests return HTTP 401).

## Timeline
- Local data: removed immediately.
- Backend data: removed immediately from the primary database.
- **Backups:** encrypted database backups may persist for up to [30] days before rotating out.
  [CONFIRM ACTUAL BACKUP RETENTION WITH INFRA.]
- Data already sent to the AI provider during past reviews is governed by that provider's
  retention policy; we do not control provider-side retention. [LINK PROVIDER POLICY.]

## Local-only users
If you never created an account, all your data already lives only on your device. Deleting it is
as simple as removing the app's data folder (also exposed via Settings → Data).

Contact for deletion help: [support@DOMAIN].
