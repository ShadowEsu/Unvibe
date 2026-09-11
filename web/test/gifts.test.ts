import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { applyGiftsForEmail, claimGift, MAX_GIFTS, specialCharForEmail } from '../src/billing/gifts';
import { getBillingStore, resetBillingStoreCacheForTests } from '../src/billing/store';
import { getStore, resetStoreCacheForTests } from '../src/data/store';

function resetStores(): void {
  const g = globalThis as unknown as { __uncodeData?: unknown; __uncodeBillingData?: unknown; __unvibeGiftClaims?: unknown };
  g.__uncodeData = undefined;
  g.__uncodeBillingData = undefined;
  g.__unvibeGiftClaims = undefined;
  resetStoreCacheForTests();
  resetBillingStoreCacheForTests();
}

test('gift code is proven from the giver email', () => {
  const code = specialCharForEmail('Preston@Unvibe.site');
  assert.equal(code.length, 8);
  assert.equal(code, specialCharForEmail('preston@unvibe.site'));
  assert.notEqual(code, specialCharForEmail('other@unvibe.site'));
});

test('verified gift grants both people a Pro month and caps at five', async () => {
  resetStores();
  const giver = await getStore().signUp('giver@example.com');
  const receiver = await getStore().signUp('friend@example.com');
  assert.ok(giver && receiver);
  const billing = getBillingStore();
  await billing.ensurePersonalWorkspace(giver.userId);
  await billing.ensurePersonalWorkspace(receiver.userId);
  const code = specialCharForEmail(giver.email);
  const first = await claimGift({ giverEmail: giver.email, recipientEmail: receiver.email, promoCode: code });
  assert.equal(first.progress.joined, 1);
  assert.equal(first.progress.used, 1);
  assert.equal(first.progress.limit, MAX_GIFTS);
  assert.equal(first.granted.giver, true);
  assert.equal(first.granted.receiver, true);
  assert.equal((await billing.overview(giver.userId)).subscription.plan, 'pro');
  assert.equal((await billing.overview(receiver.userId)).subscription.plan, 'pro');
  await assert.rejects(
    claimGift({ giverEmail: giver.email, receiverEmail: receiver.email, promoCode: code }),
    /already claimed/i,
  );
  await assert.rejects(
    claimGift({ giverEmail: giver.email, receiverEmail: receiver.email, promoCode: 'deadbeef' }),
    /does not match/i,
  );
  for (let n = 2; n <= MAX_GIFTS; n += 1) {
    const extra = await getStore().signUp(`friend${n}@example.com`);
    assert.ok(extra);
    await billing.ensurePersonalWorkspace(extra.userId);
    await claimGift({ giverEmail: giver.email, receiverEmail: extra.email, promoCode: code });
  }
  await assert.rejects(
    claimGift({ giverEmail: giver.email, receiverEmail: `friend${randomUUID()}@example.com`, promoCode: code }),
    /five gifts/i,
  );
});

test('pending gift applies when the account appears later', async () => {
  resetStores();
  const code = specialCharForEmail('later@example.com');
  await claimGift({ giverEmail: 'later@example.com', receiverEmail: 'newfriend@example.com', promoCode: code });
  const store = getStore();
  const account = await store.signUp('later@example.com');
  assert.ok(account);
  await getBillingStore().ensurePersonalWorkspace(account.userId);
  const applied = await applyGiftsForEmail(account.email);
  assert.equal(applied, 1);
  assert.equal((await getBillingStore().overview(account.userId)).subscription.plan, 'pro');
});
