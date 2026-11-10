// QA upgrade fixture with NO hosted-AI call (591, BOSS 10 Nov): start the OLD installed app once through its debug
// port (app/e2e/cdp-launch.mjs) on the row's pre-flagged qa- profile, then give the send agreement through the app's
// own IPC (window.unvibe.consentAgree → main's consent:agree → ConsentStore.agree writes unvibe-consent.json; it sends
// nothing, a send only ever starts from startReview). The upgrade rows then compare that install id and consent record
// across the upgrade (I-2) exactly as before, without the sample explanation first-explain.mjs AGREE=1 made.
// Env: UNVIBE_EXE (the old installed exe), USER_DATA (the profile), OUT. Writes OUT/fixture-report.txt; exit 1 on a FAIL.
import { launchApp, readStore } from './cdp-launch.mjs';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const { UNVIBE_EXE: exe, USER_DATA: userData, OUT: out } = process.env;
mkdirSync(out, { recursive: true });
const report = [];
let fails = 0;
const log = (ok, step, detail = '') => { if (!ok) fails++; report.push(`${ok ? 'PASS' : 'FAIL'}  ${step}${detail ? `: ${detail}` : ''}`); console.log(report.at(-1)); };
const note = (s) => { report.push(`NOTE  ${s}`); console.log(report.at(-1)); };
const finish = () => { writeFileSync(path.join(out, 'fixture-report.txt'), `${report.join('\n')}\n`); process.exit(fails ? 1 : 0); };

const store = readStore(userData);
note(`profile ${userData}; install id before launch: ${store.installId ?? 'none'}`);
if (!String(store.installId ?? '').startsWith('qa-')) { log(false, 'install id is qa-prefixed before the debug launch', String(store.installId)); finish(); }

let app;
try {
  app = await launchApp({ exe, userData, timeout: 120000 });
} catch (e) { log(false, 'old app starts with its debug port', e.message.split('\n')[0]); finish(); }
const companion = await app.windowWith('companion.html', 60000);
if (!companion) { log(false, 'companion window opens'); await app.close(); finish(); }
await companion.waitForLoadState('domcontentloaded');
const info = await companion.evaluate(() => window.unvibe?.appInfo?.()).catch(() => null);
log(true, 'companion window opens', `version ${info?.version ?? 'unknown'}`);
try {
  const status = await companion.evaluate(() => window.unvibe.consentStatus());
  const answer = await companion.evaluate((provider) => window.unvibe.consentAgree({ aiSend: true, terms: true, age18: true, provider }), status.provider);
  log(answer?.ok === true, 'send agreement given through the app (consentAgree, nothing sent)', `provider ${status.provider}${answer?.ok ? '' : `; ${answer?.error ?? 'no answer'}`}`);
} catch (e) { log(false, 'send agreement given through the app (consentAgree, nothing sent)', e.message.split('\n')[0]); }
log(existsSync(path.join(userData, 'unvibe-consent.json')), 'the profile holds the consent record (unvibe-consent.json)');
note(`install id after: ${readStore(userData).installId ?? 'none'}`);
await app.close().catch(() => {});
finish();
