import assert from 'node:assert/strict';
import { test } from 'node:test';
import { stripeRedirect } from '../src/billing/stripeRedirect';

test('/plan follows Stripe Checkout and the customer portal', () => {
  assert.equal(stripeRedirect('https://checkout.stripe.com/c/pay/cs_test_a1#fid'), 'https://checkout.stripe.com/c/pay/cs_test_a1#fid');
  assert.equal(stripeRedirect('https://billing.stripe.com/p/session/test_YWNjdA'), 'https://billing.stripe.com/p/session/test_YWNjdA');
});

test('/plan refuses any other place, look-alike or scheme', () => {
  for (const url of [
    'https://evil.example/c/pay/cs_test',
    'https://checkout.stripe.com.evil.example/pay',
    'https://evilcheckout.stripe.com/pay',
    'http://checkout.stripe.com/c/pay/cs_test',
    'https://user:pass@checkout.stripe.com/c/pay/cs_test',
    'https://checkout.stripe.com:8443/c/pay/cs_test',
    'javascript:alert(1)',
    '//checkout.stripe.com/c/pay/cs_test',
    '/plan?checkout=success',
    '',
    undefined,
    { href: 'https://checkout.stripe.com/' },
  ]) {
    assert.equal(stripeRedirect(url), null, String(url));
  }
});
