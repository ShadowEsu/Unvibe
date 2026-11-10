// QA (#204 post-deploy, the lead): does a follow-up answer at Advanced still come back as a markdown table?
// The installed app on a pre-flagged qa- profile, driven through its debug port: onboarding sample → Advanced →
// "What happens if I call it five times quickly?" (send agreement ticked if asked) → the answer's text.
// A table = a '|…|' row followed by a '|---' separator row. Before #204 it was about 1 in 2.
// Env: UNVIBE_EXE, USER_DATA (pre-seeded, pre-flagged), OUT. Writes OUT/followup.json; exit 1 on an error.
import { launchApp } from './cdp-launch.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const { UNVIBE_EXE: exe, USER_DATA: userData, OUT: out } = process.env;
mkdirSync(out, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const QUESTION = 'What happens if I call it five times quickly?';
const result = { question: QUESTION, depth: 'advanced', error: null, answer: '', table: false, separatorRows: [], answerPipes: 0 };
const done = (code) => { writeFileSync(path.join(out, 'followup.json'), JSON.stringify(result, null, 2)); console.log(JSON.stringify({ ...result, answer: `${result.answer.slice(0, 160)}…` })); process.exit(code); };
// 591 (BOSS, 10 Nov): no hosted-AI call from any QA run; refuses before the app starts unless the workflow sets
// QA_AI_OK=1 (every QA workflow fixes it to "0" in its env; a commit-message marker can't change it).
if (process.env.QA_AI_OK !== '1') { result.error = 'REFUSED hosted-AI step blocked: QA_AI_OK is not 1 (591)'; done(3); }

const app = await launchApp({ exe, userData, timeout: 120000 }).catch((e) => { result.error = `launch: ${e.message}`; done(1); });
const errors = [];
app.onWindow((p) => p.on('pageerror', (e) => errors.push(e.message.split('\n')[0])));
async function settled() {
  const start = Date.now();
  while (Date.now() - start < 150000) {
    const panel = await app.windowWith('widget.html', 20000);
    if (!panel) break;
    if (await panel.getByText("Couldn't explain that").count()) throw new Error(`explanation failed: ${(await panel.locator('.state').first().innerText().catch(() => '')).slice(0, 200)}`);
    try {
      await panel.locator('.card--done .local-save-note').last().waitFor({ timeout: 3000 });
      await panel.locator('.body .cursor').waitFor({ state: 'detached', timeout: 30000 });
      await sleep(800);
      return panel;
    } catch { await sleep(500); }
  }
  throw new Error('no settled answer in 150 s');
}
try {
  const companion = await app.windowWith('companion.html', 60000);
  await companion.locator('.ob2__count').filter({ hasText: '1 / ' }).waitFor({ timeout: 20000 });
  await companion.getByPlaceholder('Your name').fill('QA');
  await companion.getByRole('button', { name: "Let's go", exact: true }).click();
  await companion.getByRole('button', { name: 'Explain this code', exact: true }).click({ timeout: 10000 });
  let panel = await settled();
  await panel.locator('.lvl[data-level="advanced"]').click();
  await sleep(1500);
  panel = await settled();
  const before = await panel.locator('.body').innerText();
  const ask = async () => {
    const row = panel.locator('.askrow');
    const field = row.getByLabel('Follow-up question');
    if ((await field.inputValue()).trim() !== QUESTION) await field.fill(QUESTION);
    await row.getByRole('button', { name: 'Ask', exact: true }).click();
  };
  await ask();
  // The question is the person's own text, so the send agreement comes first (0.1.46+); then ask again.
  const form = panel.locator('.consent-form');
  if (await form.waitFor({ timeout: 6000 }).then(() => true, () => false)) {
    const boxes = form.locator('input[type="checkbox"]');
    for (let i = 0; i < await boxes.count(); i++) await boxes.nth(i).check();
    await form.getByRole('button', { name: 'Continue', exact: true }).click();
    await form.waitFor({ state: 'detached', timeout: 10000 });
    await ask();
  }
  await sleep(2000);
  panel = await settled();
  const after = await panel.locator('.body').innerText();
  result.answer = (after.startsWith(before) ? after.slice(before.length) : after).trim();
  // Rendered text: the panel shows an unrendered table as its raw '|' rows (P3, richText.tsx), so the markdown
  // separator row is visible in the text.
  result.separatorRows = result.answer.split('\n').filter((l) => /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(l) || /\|\s*:?-{3,}:?\s*\|/.test(l));
  result.table = result.separatorRows.length > 0;
  result.answerPipes = (result.answer.match(/\|/g) ?? []).length;
  await panel.screenshot({ path: path.join(out, 'followup.png') });
  await panel.locator('.body').evaluate((el) => el.scrollTo({ top: el.scrollHeight }));
  await panel.screenshot({ path: path.join(out, 'followup-end.png') });
} catch (e) {
  result.error = e.message.split('\n')[0];
}
result.pageErrors = errors;
await app.close();
done(result.error ? 1 : 0);
