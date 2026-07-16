# Account deletion flow — engineering draft

1. Authenticated user selects deletion in the desktop UI and confirms.
2. Main process sends `DELETE /api/v1/account` with the bearer token over the configured backend origin.
3. Backend resolves the token to a user, deletes primary records (`events`, `tokens`, `device_codes`, `consent_log`, `users`; `skills` cascades through `users`), and returns success only if operations do not report an error.
4. Desktop closes widgets and wipes its local event/outbox/account store after backend success.
5. Reusing the old token must return 401.

The guarded staging script seeds a disposable account/event/consent/skill/session, calls the real endpoint, asserts zero primary rows, and tests token replay. It has not been run without staging credentials. Auth-provider user deletion is not part of the custom endpoint because the production device flow maps an external Supabase Auth user to the custom `users` row; counsel/product must decide whether deleting the external Auth identity is also required and implement it before launch.

Backups, platform logs, support records, and provider request retention are not deleted by this code path and require approved policies/processes. Do not promise immediate universal erasure.
