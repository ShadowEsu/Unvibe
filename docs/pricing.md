# Pricing (launch configuration)

## What customers pay for

Unvibe charges for cloud-generated code explanations only. The following remain free on every plan:

- learning history and progress
- saved explanations and snippets
- comprehension checks
- concept tracking and review
- explanation-depth controls

An explanation is a request to explain selected code or approved context. It is counted when the provider successfully completes the explanation. Failed provider requests release their reservation and do not consume an allowance.

## Public plans

| Plan | Monthly | Annual | Included explanation allowance |
| --- | --- | --- | --- |
| Pro | $12 per person/month | $8 per person/month, billed annually ($96) | 50 per person/month |
| Team | $8 per person/month | $6 per person/month, billed annually ($72 per person) | 50 per person/month |

Private-beta access is free while invitations are open and uses the same 50-explanation monthly allowance. The plan record is kept separate from the entitlement so a billing provider can replace beta access without a client update.

## Professional plan

Professional is deliberately not public-priced yet. Before it is offered, set its allowance and price from measured model cost, support load, and the extra capabilities actually delivered. Do not market unlimited AI usage without a hard fair-use policy and provider-cost model.

## Billing activation checklist

1. Choose a payment provider and create product/price IDs for the two public plans.
2. Add server-only provider credentials to the deployed backend; never expose them to the desktop renderer or marketing site.
3. Verify signed webhooks and upsert `subscriptions` from webhook events.
4. Apply the billing migration before enabling quota enforcement in production.
5. Test failed payment, canceled subscription, annual renewal, seat changes, and webhook retries.

Until those steps are complete, the product must describe pricing as planned and keep checkout disabled.
