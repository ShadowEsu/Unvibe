import assert from 'node:assert/strict';
import test from 'node:test';
import { giftCodeFromEmail, giftCodeMatchesEmail, isGiftSubscriptionId } from '../src/gifts/codes';
import { resetGiftMemory } from '../src/gifts/ledger';
import { applyPendingGiftMonths, claimGift, giftProgress } from '../src/gifts/service';
import { getStore } from '../src/data/store';
import { getBillingStore } from '../src/billing/store';

function uniqueEmail(label: string): string {
  return `${label}.${Date.now()}.${Math.random().toString(16).slice(2)}@example.test`;
}

test('SPECIAL CHAR is the first eight hex characters of the email hash', () => {
  const code = giftCodeFromEmail('Preston@unvibe.site');
  assert.equal(code.length, 8);
  assert.match(code, /^[a-f0-9]{8}$/);
  assert.equal(code, giftCodeFromEmail('preston@unvibe.site'));
  assert.equal(giftCodeMatchesEmail('preston@unvibe.site', code), true);
  assert.equal(giftCodeMatchesEmail('preston@unvibe.site', 'ZZZZZZZZ'), false);
});

test('gift Stripe ids do not look like live subscriptions', () => {
  assert.equal(isGiftSubscriptionId('gift:workspace-1'), true);
  assert.equal(isGiftSubscriptionId('sub_123'), false);
  assert.equal(isGiftSubscriptionId(undefined), false);
});

test('a matching friend email and SPECIAL CHAR grants both people a month of Pro', async () => {
  resetGiftMemory();
  const giverEmail = uniqueEmail('giver');
  const recipientEmail = uniqueEmail('friend');
  const giver = await getStore().signIn(giverEmail);
  const result = await claimGift({
    recipientEmail,
    giverEmail,
    promoCode: giftCodeFromEmail(giverEmail),
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.granted, true);
  assert.equal(result.used, 1);
  const overview = await getBillingStore().overview(giver.userId);
  assert.equal(overview.subscription.plan, 'pro');
  assert.equal(overview.subscription.status, 'trialing');
  assert.equal(isGiftSubscriptionId(overview.subscription.stripeSubscriptionId), true);
  const pending = await giftProgress(giftCodeFromEmail(giverEmail));
  assert.equal(pending.found, true);
  assert.equal(pending.used, 1);
});

test('pending gift months apply when the recipient later signs in', async () => {
  resetGiftMemory();
  const giverEmail = uniqueEmail('later-giver');
  const recipientEmail = uniqueEmail('later-friend');
  const claim = await claimGift({
    recipientEmail,
    giverEmail,
    promoCode: giftCodeFromEmail(giverEmail),
  });
  assert.equal(claim.ok, true);
  const recipient = await getStore().signIn(recipientEmail);
  await applyPendingGiftMonths(recipient.userId, recipientEmail);
  const overview = await getBillingStore().overview(recipient.userId);
  assert.equal(overview.subscription.plan, 'pro');
  assert.equal(overview.subscription.status, 'trialing');
});

test('unknown, self, and sixth gifts are rejected', async () => {
  resetGiftMemory();
  const giverEmail = uniqueEmail('cap-giver');
  const code = giftCodeFromEmail(giverEmail);
  const self = await claimGift({ recipientEmail: giverEmail, giverEmail, promoCode: code });
  assert.equal(self.ok, false);
  const unknown = await claimGift({
    recipientEmail: uniqueEmail('stranger'),
    giverEmail,
    promoCode: 'deadbeef',
  });
  assert.equal(unknown.ok, false);
  if (!unknown.ok) assert.equal(unknown.error, 'unknown_code');
  for (let i = 0; i < 5; i += 1) {
    const ok = await claimGift({
      recipientEmail: uniqueEmail(`cap-${i}`),
      giverEmail,
      promoCode: code,
    });
    assert.equal(ok.ok, true);
  }
  const sixth = await claimGift({
    recipientEmail: uniqueEmail('cap-sixth'),
    giverEmail,
    promoCode: code,
  });
  assert.equal(sixth.ok, false);
  if (!sixth.ok) assert.equal(sixth.error, 'gift_cap');
});
