import assert from 'node:assert/strict';
import test from 'node:test';
import { GET as promoList, POST as promoAction } from '../app/api/v1/admin/promo/route';
import { POST as qaInstall } from '../app/api/v1/admin/qa-install/route';
import { GET as stats } from '../app/api/v1/admin/stats/route';

// No database: an authorized qa-install answers 503 (storage unavailable) instead of 401.
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_TOKEN = 'test-admin-token-0123456789abcdef';
const QA_TOKEN = 'test-qa-flag-token-0123456789abcdef';
process.env.UNVIBE_ADMIN_STATS_TOKEN = ADMIN_TOKEN;
process.env.UNVIBE_QA_FLAG_TOKEN = QA_TOKEN;

const BASE = 'https://api.unvibe.site/api/v1/admin';

function request(path: string, token: string | null, body?: unknown): Request {
  return new Request(`${BASE}/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const flag = (token: string | null) => qaInstall(request('qa-install', token, { installId: 'media-capture-1-1' }));

test('the CI QA token can flag a test install', async () => {
  assert.notEqual((await flag(QA_TOKEN)).status, 401);
});

test('the CI QA token is refused on every other admin route', async () => {
  assert.equal((await stats(request('stats', QA_TOKEN))).status, 401);
  assert.equal((await promoList(request('promo', QA_TOKEN))).status, 401);
  // The promo POST is how a batch is revoked.
  assert.equal((await promoAction(request('promo', QA_TOKEN, { action: 'revoke', batchId: 'calhacks13' }))).status, 401);
});

test('the admin token still flags installs until CI stops holding it', async () => {
  assert.notEqual((await flag(ADMIN_TOKEN)).status, 401);
});

test('qa-install refuses no token, a wrong token, and the QA token once it is unset', async () => {
  assert.equal((await flag(null)).status, 401);
  assert.equal((await flag('not-the-token-0123456789abcdef')).status, 401);
  delete process.env.UNVIBE_QA_FLAG_TOKEN;
  try {
    assert.equal((await flag(QA_TOKEN)).status, 401);
  } finally {
    process.env.UNVIBE_QA_FLAG_TOKEN = QA_TOKEN;
  }
});

test('a QA secret under 32 characters is never accepted', async () => {
  const short = 'qa-flag-token-31-chars-xxxxxxxx';
  assert.equal(short.length, 31);
  process.env.UNVIBE_QA_FLAG_TOKEN = short;
  try {
    assert.equal((await flag(short)).status, 401);
  } finally {
    process.env.UNVIBE_QA_FLAG_TOKEN = QA_TOKEN;
  }
});
