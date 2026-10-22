import './nextAsyncLocalStorage';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { requestAsyncStorage, type RequestStore } from 'next/dist/client/components/request-async-storage.external';
import { RequestCookiesAdapter } from 'next/dist/server/web/spec-extension/adapters/request-cookies';
import { RequestCookies } from 'next/dist/server/web/spec-extension/cookies';
import { getURLFromRedirectError, isRedirectError } from 'next/dist/client/components/redirect';
import PlanPage from '../app/plan/page';
import { getStore } from '../src/data/store';

// Real /plan page inside a real Next request scope (cookies() reads the request's Cookie header).
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

type PlanResult = { redirect: string } | { html: string };

/** Renders GET /plan?<query> as the browser would send it, with an optional session cookie. */
async function getPlan(query: string, sessionToken?: string): Promise<PlanResult> {
  const headers = new Headers(sessionToken ? { cookie: `uncode_session=${sessionToken}` } : {});
  const store = { headers, cookies: RequestCookiesAdapter.seal(new RequestCookies(headers)) } as unknown as RequestStore;
  const searchParams = Object.fromEntries(new URLSearchParams(query));
  return requestAsyncStorage.run(store, async () => {
    try {
      const element: ReactElement = await PlanPage({ searchParams });
      return { html: renderToStaticMarkup(element) };
    } catch (error) {
      if (isRedirectError(error)) return { redirect: getURLFromRedirectError(error) };
      throw error;
    }
  });
}

function html(result: PlanResult): string {
  assert.ok('html' in result, `expected a page, got a redirect to ${'redirect' in result ? result.redirect : ''}`);
  return result.html;
}

test('a cookie-less browser returning from a successful checkout sees a static confirmation', async () => {
  const page = html(await getPlan('checkout=success&session_id=cs_test_x'));
  assert.equal(page.match(/<h1[\s>]/g)?.length, 1);
  assert.match(page, /<h1[^>]*>Payment received<\/h1>/);
  assert.match(page, /Go back to the Unvibe app\. Your plan updates there within a minute\./);
  assert.doesNotMatch(page, /cs_test_x/);
  assert.doesNotMatch(page, /\u2014/);
});

test('a cookie-less browser returning from a canceled checkout sees a neutral note', async () => {
  const page = html(await getPlan('checkout=canceled'));
  assert.equal(page.match(/<h1[\s>]/g)?.length, 1);
  assert.match(page, /<h1[^>]*>Checkout canceled<\/h1>/);
  assert.match(page, /Nothing was charged\./);
});

test('an unknown session token is treated as signed out on the checkout return', async () => {
  const page = html(await getPlan('checkout=success&session_id=cs_test_x', 'not-a-real-session'));
  assert.match(page, /Payment received/);
});

test('/plan without a session and without a checkout return still redirects to sign in', async () => {
  assert.deepEqual(await getPlan(''), { redirect: '/login' });
  assert.deepEqual(await getPlan('checkout=other'), { redirect: '/login' });
});

test('a signed-in buyer returning from checkout still gets the full plan page', async () => {
  const account = await getStore().signIn(`return-${randomUUID()}@checkout.test`);
  const page = html(await getPlan('checkout=success&session_id=cs_test_x', account.token));
  assert.match(page, /Understand more\. Pay only when you need more room\./);
  assert.doesNotMatch(page, /Payment received/);
});
