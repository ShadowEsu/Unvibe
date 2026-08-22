# Two-user RLS test matrix

Run `npm run test:rls:staging` with the guarded staging environment. The suite creates User A and User B through Supabase Auth, seeds service-owned rows, signs in each direct client, and removes both users afterward.

| Resource | User's permitted direct action | Cross-user result | Direct mutation result | Current state |
| --- | --- | --- | --- | --- |
| `users` | Read own profile | Zero rows | No client write grant | Executable |
| `events` | Read own events | Zero rows | Rejected; backend service owns writes | Executable |
| `skills` | Read own skill summaries | Zero rows | Rejected; backend rebuild owns writes | Executable after migration 0007 |
| `consent_log` | Read own consent history | Zero rows | Rejected; server owns writes | Policy present; seed/read extension is manual |
| `tokens` | None | Rejected | Rejected | Executable server-only assertion |
| `device_codes` | None | Rejected | Rejected | Executable server-only assertion |
| Projects | N/A | N/A | N/A | Not a persisted table; derived from events |
| Notes | N/A | N/A | N/A | Not implemented |
| Saved explanations | N/A | N/A | N/A | Not implemented |
| Billing/workspaces | own membership via server | denied | denied | Implemented in additive migration; staging RLS/service-role verification still required |

Pass means both users see exactly one own row for seeded readable resources, see no other-user rows, cannot write directly, and cannot query server-only tables. “Table absent” is an explicit product limitation, not a passing RLS assertion.
