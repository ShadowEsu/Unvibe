# Pro plan decision record

Status: superseded for product engineering by the Free/Pro/Teams implementation in
`docs/billing.md`; production billing remains disabled pending verification and approval.

## Recommended beta decision

Keep the private beta at no charge and require no credit card. Describe this narrowly as “No charge during the current private beta” and state that users will receive clear notice and must affirmatively choose before any future paid service. Do not promise permanently free, unlimited model usage, or a future price.

## Decisions required before any test billing work

- Free allowance/fair-use limits and abuse handling.
- Pro customer, feature entitlements, usage caps, price/currency/tax, trials/refunds, cancellation/effective date, and failed-payment behavior.
- Whether paid inference economics work under measured provider cost and latency.
- Legal/tax/accounting approval and support/refund owner.
- Stripe test project, product/price IDs, webhook secret, idempotency/event-replay design, entitlement source of truth, and two-user isolation tests.

Any later implementation must start in Stripe test mode, use no real charges, keep secrets server-only, verify webhook signatures/idempotency, and show backend-derived entitlements. A frontend “Pro” badge or hardcoded access state is not an implementation.
