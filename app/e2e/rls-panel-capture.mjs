// Real panel captures for Marketing's code-history reels: the released app explaining one code card.
// Presets (CAPTURE_PRESET): 'rls' (ep02, request 20261028-1601), 'flag' (ep03, 20261028-2155), 'workflow' (ep04, 20261029-0005), 'lint' (ep05, 20261029-0040), 'rust' (20261029-0100), 'ifreturn' (20261029-0105), 'regex' (20261029-0016), 'pyguard' (ep09, 20261029-0112), 'javamid' (ep10, 20261029-0346), 'pylower' (ep11, 20261029-1340), 'pyexists' (ep12, 20261029-1345), 'goptr' (ep13), 'pyassert' (ep14), 'pyresub' (ep15), 'jsreduce' (ep16), 'pyfstring' (ep17), 'jsternary' (ep18).
// Same method as marketing-media.mjs: the installed release build and the hosted AI; nothing mocked.
// Up to 3 takes (each a fresh explanation of the same file); each take's panel and text are saved, and
// a take whose answer uses a banned word (it would imply detection) is discarded and retaken.
//   UNVIBE_EXE=... MEDIA_DIR=... MEDIA_INSTALL_ID=... CAPTURE_PRESET=rls|flag node rls-panel-capture.mjs
import { _electron as electron } from 'playwright';
import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const exe = process.env.UNVIBE_EXE;
if (!exe) throw new Error('Set UNVIBE_EXE to an installed release build');
const out = path.resolve(process.env.MEDIA_DIR ?? 'media');
const shots = path.join(out, 'shots');
mkdirSync(shots, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PRESETS = {
  rls: {
    file: 'profiles_policy.sql',
    code: 'create policy "Users read own rows" on profiles\nfor select using ( (select auth.uid()) = user_id );\n',
    match: 'auth.uid()',
    level: null,
    banned: /\b(in)?secure\b|vulnerab/i,
  },
  // Beginner: the Intermediate answer carries a standard "Potential Risks" section the reel can't show.
  flag: {
    file: 'trade.js',
    code: 'if (flag) runLegacy();\n',
    match: 'runLegacy',
    level: 'beginner',
    banned: /\bbugs?\b|\bbuggy\b|\brisk|danger|vulnerab|\b(in)?secure\b|should (be )?remove|\bremove (it|this|the)\b|dead code/i,
  },
  // ep04 (request 20261029-0005): the frame is cropped above the Risks heading, so only the text
  // before that heading is checked.
  workflow: {
    file: '.github/workflows/ci.yml',
    code: '      - run: npm ci\n',
    match: 'npm ci',
    level: 'beginner',
    cropAtHeading: true,
    banned: /\bbugs?\b|\bbuggy\b|\brisk|danger|vulnerab|\b(in)?secure\b/i,
  },
  // ep05 (request 20261029-0040): cropped above the first "Why …" heading (it comes before the Risks section).
  lint: {
    file: 'src/utils.js',
    code: '// eslint-disable-next-line no-unused-vars\n',
    match: 'eslint-disable',
    level: 'beginner',
    cropAtHeading: true,
    banned: /\bbugs?\b|\bbuggy\b|\brisk|danger|vulnerab|\b(in)?secure\b|\bhid(e|es|ing|den)\b/i,
  },
  // Request 20261029-0100: '?' returns the error to the caller; a take that says it panics or crashes is wrong.
  rust: {
    file: 'src/main.rs',
    code: 'let config = load_config()?;\n',
    match: 'load_config',
    level: 'beginner',
    cropAtHeading: true,
    banned: /\bbugs?\b|\bbuggy\b|\brisk|danger|vulnerab|\b(in)?secure\b|\bcrash|\bpanic/i,
  },
  ifreturn: {
    file: 'src/profile.js',
    code: 'if (!user) return;\n',
    match: '!user',
    level: 'beginner',
    cropAtHeading: true,
    // Marketing (ep07): an exact panel. 'empty' is not falsy for {} or [], so any take that calls a
    // value empty, or lists falsy values as a partial set, is retaken.
    banned: /\bbugs?\b|\bbuggy\b|\brisk|danger|vulnerab|\b(in)?secure\b|\bempty\b(?!\s+(string|text)\b)|falsy"?\s*\((?![^)]*\b0\b)[^)]*\)/i,
  },
  // ep08: in JavaScript \d without the u flag is ASCII 0-9 only, so any Unicode-digit claim is wrong.
  regex: {
    file: 'src/forms/address.js',
    code: 'const isZip = /^\\d{5}$/.test(input);\n',
    match: 'isZip',
    level: 'beginner',
    cropAtHeading: true,
    banned: /\bbugs?\b|\bbuggy\b|\brisk|danger|vulnerab|\b(in)?secure\b|unicode/i,
  },
  // ep09: `not items` is True for every falsy value; a take that names a partial set in parentheses as if
  // complete ("empty (an empty list or None)"), or says it raises, is retaken. Marketing checks the rest.
  pyguard: {
    file: 'app/cart.py',
    code: 'if not items: return []\n',
    match: 'not items',
    level: 'beginner',
    cropAtHeading: true,
    banned: /\bbugs?\b|\bbuggy\b|\brisk|danger|vulnerab|\b(in)?secure\b|\braises?\b|\bonly (if|when) (items|the list) is (empty|None)\b/i,
  },
  // ep10: Java int overflow wraps silently (never throws), and int division truncates (rounds down for
  // non-negative values). A take that says it throws, rounds up, or works for any numbers is retaken.
  javamid: {
    file: 'src/main/java/demo/Search.java',
    code: 'int mid = start + (end - start) / 2;\n',
    match: 'int mid',
    level: 'beginner',
    cropAtHeading: true,
    banned: /\bbugs?\b|\bbuggy\b|\brisk|danger|vulnerab|\b(in)?secure\b|\bthrows?\b|exception|\brounds? up\b|rounding up|\bfor any (numbers?|integers?|values?)\b/i,
  },
  // ep11: strip() trims only the ends (not spaces inside), and lower() only changes case. Neither makes a
  // username unique, safe or valid. A take that claims any of that is retaken once (maxTakes 2), then dropped.
  pylower: {
    file: 'app/users.py',
    code: 'username = username.strip().lower()\n',
    match: 'username.strip',
    level: 'beginner',
    cropAtHeading: true,
    maxTakes: 2,
    banned: /\bbugs?\b|\bbuggy\b|\brisk|danger|vulnerab|\b(in)?secure\b|\bunique\b|\bsafe(ly|r)?\b|sanitiz|validat|\binjection\b|\bprevents?\b|\ball (the )?(spaces|whitespace)\b|spaces? (inside|in the middle|between)/i,
  },
  // ep12: the file can vanish between exists() and remove() (a race), so the check doesn't make remove()
  // safe or error-free. A take that says safe, always/never, guarantees or ensures is retaken once, then dropped.
  pyexists: {
    file: 'app/cleanup.py',
    code: 'if os.path.exists(path): os.remove(path)\n',
    match: 'os.path.exists',
    level: 'beginner',
    cropAtHeading: true,
    maxTakes: 2,
    banned: /\bbugs?\b|\bbuggy\b|\brisk|danger|vulnerab|\b(in)?secure\b|\bsafe(ly|r|ty)?\b|\balways\b|\bnever (fails?|crash(es)?|errors?|raises?|breaks?)\b|\bguarantee|\bensures?\b|\bmakes? sure\b|\bno (chance|way) (of|for) an? (error|crash)\b/i,
  },
  // ep13: &users[i] is the address of the slice element itself, not a copy, and the line has no loop
  // variable in it. A take that calls it a copy or talks about loop/range variables is retaken once, then dropped.
  goptr: {
    file: 'internal/users/list.go',
    code: 'ptrs = append(ptrs, &users[i])\n',
    match: 'append(ptrs',
    level: 'beginner',
    cropAtHeading: true,
    maxTakes: 2,
    banned: /\bbugs?\b|\bbuggy\b|\brisk|danger|vulnerab|\b(in)?secure\b|\b(makes?|creates?|takes?|stores?|adds?|appends?|saves?|gets?) an? (new |separate |fresh )?copy\b|&users\[i\]`?,? (is|gives|returns|holds) an? copy|\bcopy of (each|every) (user|element)\b|\b(loop|range|iteration) variables?\b|\bcaptur(e|es|ed|ing)\b|Go 1\.22/i,
  },
  // ep14: Python skips asserts under -O, so this line doesn't guarantee or enforce the limit in production.
  // A take that says it guarantees, enforces, ensures or prevents (or "always"/"never exceeds") is retaken once, then dropped.
  pyassert: {
    file: 'app/parser.py',
    code: 'assert len(stack) < MAX_DEPTH, "stack too deep"\n',
    match: 'MAX_DEPTH',
    level: 'beginner',
    cropAtHeading: true,
    maxTakes: 2,
    banned: /\bbugs?\b|\bbuggy\b|\brisk|danger|vulnerab|\b(in)?secure\b|\bsafe(ly|r|ty)?\b|\bguarantee|\benforc|\bensures?\b|\bmakes? sure\b|\bprevents?\b|\balways\b|\bnever (exceeds?|goes|grows|gets|reaches|passes)\b/i,
  },
  // ep15: the visible text must not call this safe, efficient or fine for any input, and must not mention
  // slowness or backtracking (it would read as "Unvibe would have caught this"). Retaken once, then dropped.
  pyresub: {
    file: 'app/clean.py',
    code: 'line = re.sub(r"\\s+$", "", line)\n',
    match: 're.sub',
    level: 'beginner',
    cropAtHeading: true,
    maxTakes: 2,
    banned: /\bbugs?\b|\bbuggy\b|\brisk|danger|vulnerab|\b(in)?secure\b|\bsafe(ly|r|ty)?\b|\befficien(t|tly|cy)\b|\bfine for\b|\bany (input|string|text|line)\b|\bslow(ness|ly|er|s|down)?\b|backtrack|catastrophic|redos|performance|quadratic|\bfast(er)?\b/i,
  },
  // ep16: the line doesn't validate prices or handle missing/non-number values (undefined gives NaN, a string
  // concatenates). A take that claims it does is retaken once, then dropped. Negated phrasing ("doesn't
  // validate") is accurate and passes; "handles an empty list" is true (the 0 start value) and passes too.
  jsreduce: {
    file: 'src/cart.js',
    code: 'const total = items.reduce((sum, i) => sum + i.price, 0);\n',
    match: 'items.reduce',
    level: 'beginner',
    cropAtHeading: true,
    maxTakes: 2,
    banned: /\bbugs?\b|\bbuggy\b|\brisk|danger|vulnerab|\b(in)?secure\b|\bsafe(ly|r|ty)?\b|(?<!(n['’]t|not|never|no) )\b(validates?|validating|sanitiz\w*)\b|(?<!(n['’]t|not|never) )\bhandles?\b[^.]{0,40}\b(missing|undefined|null|non-?numer\w*|invalid|NaN)\b|(?<!(n['’]t|not|never) )\b(ensures?|guarantees?|makes? sure)\b/i,
  },
  // ep17: the line only picks a greeting by whether name is truthy; it doesn't validate, sanitize or escape
  // name. A take that claims it does is retaken once, then dropped. Negated phrasing passes.
  pyfstring: {
    file: 'app/greet.py',
    code: 'greeting = f"Hi, {name}!" if name else "Hi there!"\n',
    match: 'greeting',
    level: 'beginner',
    cropAtHeading: true,
    maxTakes: 2,
    banned: /\bbugs?\b|\bbuggy\b|\brisk|danger|vulnerab|\b(in)?secure\b|\bsafe(ly|r|ty)?\b|(?<!(n['’]t|not|never|no) )\b(validates?|validating|validation|sanitiz\w*|escapes?|escaping)\b|(?<!(n['’]t|not|never) )\bcleans?( up)? (the )?(name|input)\b|(?<!(n['’]t|not|never) )\b(ensures?|guarantees?|makes? sure)\b/i,
  },
  // ep18: the line only picks a label from a boolean someone else set; it does no network check. A take that
  // says it checks, detects, tests, pings or monitors the network/connection is retaken once, then dropped.
  jsternary: {
    file: 'src/status.js',
    code: 'const label = isOnline ? "Online" : "Offline";\n',
    match: 'isOnline',
    level: 'beginner',
    cropAtHeading: true,
    maxTakes: 2,
    banned: /\bbugs?\b|\bbuggy\b|\brisk|danger|vulnerab|\b(in)?secure\b|\bsafe(ly|r|ty)?\b|(?<!(n['’]t|not|never|no) )\b(checks?|checking|detects?|detecting|tests?|testing|verif(y|ies|ying)|pings?|pinging|monitors?|monitoring|queries|querying|measures?)\b[^.]{0,25}\b(network|connection|connectivity|internet|server|wi-?fi|online status)\b|(?<!(n['’]t|not|never) )\b(ensures?|guarantees?|makes? sure)\b/i,
  },
};
const preset = PRESETS[process.env.CAPTURE_PRESET ?? 'rls'];
if (!preset) throw new Error(`unknown CAPTURE_PRESET ${process.env.CAPTURE_PRESET}`);
const NAME = process.env.CAPTURE_PRESET ?? 'rls';

const userData = mkdtempSync(path.join(tmpdir(), 'unvibe-rls-'));
writeFileSync(path.join(userData, 'unvibe-store.json'), JSON.stringify({ installId: process.env.MEDIA_INSTALL_ID ?? 'rlscapture0001' }));
const app = await electron.launch({
  executablePath: exe,
  args: ['--force-device-scale-factor=2'],
  env: { ...process.env, UNVIBE_USER_DATA: userData },
  timeout: 90000,
});
const version = await app.evaluate(({ app }) => app.getVersion());
console.log(`app open ${version}`);

async function windowWith(part, timeout = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const hit = app.windows().find((w) => w.url().includes(part) && !w.isClosed());
    if (hit) return hit;
    await sleep(250);
  }
  throw new Error(`${part} did not open`);
}
const button = (page, name) => page.getByRole('button', { name, exact: true }).first();

async function settledPanel() {
  const start = Date.now();
  while (Date.now() - start < 120000) {
    const panel = await windowWith('widget.html', 20000);
    try {
      if (await panel.getByText("Couldn't explain that").count()) throw new Error('explanation failed');
      await panel.locator('.card--done .local-save-note').waitFor({ timeout: 3000 });
      await panel.locator('.body .cursor').waitFor({ state: 'detached', timeout: 30000 });
      await sleep(700);
      return panel;
    } catch (e) {
      if (/explanation failed/.test(e.message)) throw e;
      if (!panel.isClosed()) await sleep(500);
    }
  }
  throw new Error('explanation did not finish in 120s');
}

const result = { version, takes: [] };
try {
  // Onboarding with a neutral name, then the built-in sample so the panel exists.
  const companion = await windowWith('companion.html', 60000);
  await companion.waitForLoadState('domcontentloaded');
  await companion.locator('.ob2__count').filter({ hasText: '1 / 3' }).waitFor({ timeout: 20000 });
  await companion.getByPlaceholder('Your name').pressSequentially('Sam', { delay: 40 });
  await button(companion, "Let's go").click();
  await companion.locator('.ob2__count').filter({ hasText: '2 / 3' }).waitFor();
  await sleep(800);
  await button(companion, 'Explain this code').click();
  await windowWith('widget.html', 20000);
  await app.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().includes('widget.html'))?.setSize(560, 720);
  });
  await settledPanel();

  // The episode's code card, exactly as the request gives it.
  const dir = realpathSync(mkdtempSync(path.join(tmpdir(), 'unvibe-capture-src-')));
  const file = path.join(dir, preset.file);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, preset.code);
  await app.evaluate(({ dialog }, picked) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [picked] }); }, file);

  for (let take = 1; take <= (preset.maxTakes ?? 3); take += 1) {
    const picked = await (await windowWith('widget.html')).evaluate(() => window.unvibe.pickFile());
    if (!picked?.ok) throw new Error(`file pick failed: ${picked?.error ?? 'cancelled'}`);
    await (await windowWith('widget.html')).locator('.code-context').filter({ hasText: preset.match }).first().waitFor({ timeout: 30000 });
    let panel = await settledPanel();
    if (preset.level) {
      await panel.locator(`.lvl[data-level="${preset.level}"]`).click();
      await sleep(1500);
      panel = await settledPanel();
    }
    const level = await panel.locator('.lvl[aria-pressed="true"], .lvl.is-active, .lvl[aria-checked="true"]').first().getAttribute('data-level').catch(() => null);
    await panel.locator('.body').evaluate((el) => el.scrollTo({ top: 0 }));
    await sleep(600);
    const text = await panel.locator('.body').innerText();
    const whole = await panel.locator('body').innerText();
    // Marketing crops the frame above the first section heading that starts with "Why" or "Risks"; the
    // model words it differently per answer ("Why it is here", "Why this formula is used"), so match any.
    // Multi-word only: the sidebar's single-word "Why" button sits above the answer in the panel text.
    const cut = (s) => {
      const at = preset.cropAtHeading ? s.search(/^[ \t]*(why|risks)\b[^\n]*?[ \t]\S/im) : -1;
      return at >= 0 ? s.slice(0, at) : s;
    };
    const banned = preset.banned.test(cut(text)) || /\b(in)?secure\b|vulnerab|danger/i.test(cut(whole));
    await panel.screenshot({ path: path.join(shots, `panel-${NAME}-take${take}.png`), animations: 'disabled' });
    writeFileSync(path.join(shots, `panel-${NAME}-take${take}.txt`), `level=${level}\nbanned=${banned}\n\n${whole}\n`);
    result.takes.push({ take, level, banned, chars: text.length });
    console.log(`take ${take}: level=${level} banned=${banned} chars=${text.length}`);
    if (!banned) break;
  }
} catch (e) {
  result.error = e.message.split('\n')[0];
  console.log(`FAIL ${result.error}`);
}
await app.close();
writeFileSync(path.join(out, `${NAME}-result.json`), JSON.stringify({ preset: NAME, ...result }, null, 2));
console.log(JSON.stringify(result));
process.exit(result.error || !result.takes.some((t) => !t.banned) ? 1 : 0);
