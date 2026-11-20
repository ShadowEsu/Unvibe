// The site hero's Today still (unvibe-site's ask under BOSS 639, Design's Option A spec
// requests/unvibe-site/20261119-1611-design-633-a-site-spec.md §3: "Real screen, sample data · Unvibe 0.1.5x"):
// the released app's Today page, light theme, 1180x780 CSS px captured at 2x (2360x1560 px), on a profile holding
// sample lessons, with the sharks backdrop switched off (Settings' start animation) so no ASCII glyph crosses a card.
// Run by real-device-test.yml with rc0154=hero (Mac only, ai off). No hosted-AI call: nothing is explained, asked or
// quizzed; the lessons are written into the profile before the first launch, as the app itself stores them.
//
// Env: UNVIBE_EXE, SHOTS_DIR, UNVIBE_OS (mac; linux = a local run against a mock backend), RC_HERO_PROFILE and
//      RC_HERO_ID (a qa- id the workflow pre-flags and flags again after), UNVIBE_APP_DIR (local run only).
import { launchApp, readStore } from './cdp-launch.mjs';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

const exe = process.env.UNVIBE_EXE;
const appDir = process.env.UNVIBE_APP_DIR;
const os = process.env.UNVIBE_OS ?? (process.platform === 'darwin' ? 'mac' : process.platform === 'win32' ? 'windows' : 'linux');
const out = path.resolve(process.env.SHOTS_DIR ?? 'hero-today');
const dir = process.env.RC_HERO_PROFILE;
const installId = process.env.RC_HERO_ID;
if (!exe || !dir || !installId) throw new Error('Set UNVIBE_EXE, RC_HERO_PROFILE and RC_HERO_ID');
if (process.env.QA_AI_OK === '1') throw new Error('hero-today.mjs makes no hosted-AI call: run it with ai off');
mkdirSync(out, { recursive: true });

const W = 1180;
const H = 780;
const SCALE = 2;
const report = [];
const line = (s) => { report.push(s); console.log(s); };
const log = (ok, step, detail = '') => line(`${ok ? 'PASS' : 'FAIL'}  ${step}${detail ? `: ${detail}` : ''}`);
const note = (step, detail = '') => line(`NOTE  ${step}${detail ? `: ${detail}` : ''}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const short = (e) => String(e?.message ?? e).split('\n')[0];

// --- The sample lessons -----------------------------------------------------------------------------------------
// Shaped like the app's own saved lessons (core/learning.ts LocalEvent). The first one's label and explanation are
// the ones the hosted model gave for this code in QA's Run B (44425517304); the rest are sample data, as the hero's
// caption says. Dates are this machine's local days, so the 14-day strip and Today's goal read as on a real profile.
const pad = (v) => String(v).padStart(2, '0');
const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const at = (daysAgo, hour, minute) => { const d = new Date(); d.setDate(d.getDate() - daysAgo); d.setHours(hour, minute, 0, 0); return d; };
const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
const SAMPLES = [
  { daysAgo: 0, hour: 9, minute: 12, outcome: 'understood', language: 'javascript', sourceApp: 'Cursor', file: 'src/cart/totals.js', project: 'shop',
    concept: 'array-reduce', conceptLabel: 'Array.reduce initial accumulator', answeredToday: true,
    code: 'function selectedTotal(items) {\n  return items.reduce((sum, item) => sum + item.price * item.qty, 0);\n}',
    explanation: 'selectedTotal takes an array items and returns the sum of item.price * item.qty for every entry. It uses reduce starting from 0, so an empty array returns 0. Despite the name, it does no filtering itself; it totals every item it is given.' },
  { daysAgo: 0, hour: 8, minute: 31, outcome: 'reviewed', language: 'javascript', sourceApp: 'Cursor', file: 'src/cart/groupBy.js', project: 'shop',
    concept: 'map-grouping', conceptLabel: 'Grouping into a Map',
    code: 'export function groupBy(items, keyOf) {\n  const groups = new Map();\n  for (const item of items) {\n    const key = keyOf(item);\n    const list = groups.get(key);\n    if (list) list.push(item);\n    else groups.set(key, [item]);\n  }\n  return groups;\n}' },
  { daysAgo: 1, hour: 16, minute: 40, outcome: 'understood', language: 'typescript', sourceApp: 'Cursor', file: 'src/hooks/useDebounce.ts', project: 'shop',
    concept: 'closures', conceptLabel: 'Closures in a debounce',
    code: 'export function debounce<T extends unknown[]>(fn: (...args: T) => void, ms: number) {\n  let timer: ReturnType<typeof setTimeout> | undefined;\n  return (...args: T) => {\n    clearTimeout(timer);\n    timer = setTimeout(() => fn(...args), ms);\n  };\n}\n\nexport function useDebounced<T>(value: T, ms = 250): T {\n  const [debounced, setDebounced] = useState(value);\n  useEffect(() => {\n    const id = setTimeout(() => setDebounced(value), ms);\n    return () => clearTimeout(id);\n  }, [value, ms]);\n  return debounced;\n}' },
  { daysAgo: 2, hour: 11, minute: 5, outcome: 'understood', language: 'tsx', sourceApp: 'Visual Studio Code', file: 'src/components/SearchBox.tsx', project: 'shop',
    concept: 'effect-cleanup', conceptLabel: 'useEffect cleanup',
    code: 'useEffect(() => {\n  const controller = new AbortController();\n  fetch(`/api/search?q=${query}`, { signal: controller.signal })\n    .then((r) => r.json())\n    .then(setResults)\n    .catch((err) => {\n      if (err.name !== \'AbortError\') setError(err);\n    });\n  return () => controller.abort();\n}, [query]);' },
  { daysAgo: 3, hour: 14, minute: 22, outcome: 'needs_review', language: 'sql', sourceApp: 'Visual Studio Code', file: 'db/reports/orders.sql', project: 'shop',
    concept: 'left-join', conceptLabel: 'LEFT JOIN with COALESCE',
    code: 'SELECT c.id,\n       c.name,\n       COALESCE(SUM(o.total), 0) AS spent,\n       COUNT(o.id) AS orders\nFROM customers c\nLEFT JOIN orders o\n  ON o.customer_id = c.id\n AND o.status = \'paid\'\nGROUP BY c.id, c.name\nORDER BY spent DESC;' },
  { daysAgo: 4, hour: 10, minute: 48, outcome: 'understood', language: 'python', sourceApp: 'Cursor', file: 'scripts/clean_rows.py', project: 'etl',
    concept: 'comprehension', conceptLabel: 'Filtered list comprehension',
    code: 'def active_emails(rows):\n    active = [row["email"].strip().lower()\n              for row in rows\n              if row.get("email") and not row.get("unsubscribed")]\n    seen = set()\n    unique = []\n    for email in active:\n        if email not in seen:\n            seen.add(email)\n            unique.append(email)\n    return unique' },
  { daysAgo: 5, hour: 12, minute: 10, outcome: 'understood', language: 'typescript', sourceApp: 'Cursor', file: 'src/api/client.ts', project: 'shop',
    concept: 'retry-backoff', conceptLabel: 'Retry with backoff',
    code: 'export async function withRetry<T>(run: () => Promise<T>, tries = 3): Promise<T> {\n  let last: unknown;\n  for (let attempt = 0; attempt < tries; attempt++) {\n    try {\n      return await run();\n    } catch (err) {\n      last = err;\n      await new Promise((r) => setTimeout(r, 200 * 2 ** attempt));\n    }\n  }\n  throw last;\n}' },
  { daysAgo: 6, hour: 15, minute: 30, outcome: 'understood', language: 'javascript', sourceApp: 'Cursor', file: 'src/api/load.js', project: 'shop',
    concept: 'promise-all', conceptLabel: 'Promise.all fails fast',
    code: 'export async function loadAccount(id) {\n  const [user, orders, prefs] = await Promise.all([\n    getUser(id),\n    getOrders(id),\n    getPrefs(id),\n  ]);\n  return { user, orders, prefs };\n}' },
  { daysAgo: 8, hour: 13, minute: 2, outcome: 'reviewed', language: 'go', sourceApp: 'Visual Studio Code', file: 'internal/store/open.go', project: 'etl',
    concept: 'error-wrapping', conceptLabel: 'Wrapping errors with %w',
    code: 'func Open(path string) (*Store, error) {\n    f, err := os.Open(path)\n    if err != nil {\n        return nil, fmt.Errorf("open %s: %w", path, err)\n    }\n    defer f.Close()\n    var s Store\n    if err := json.NewDecoder(f).Decode(&s); err != nil {\n        return nil, fmt.Errorf("decode %s: %w", path, err)\n    }\n    return &s, nil\n}' },
  { daysAgo: 9, hour: 17, minute: 15, outcome: 'understood', language: 'typescript', sourceApp: 'Cursor', file: 'src/lib/parseDate.ts', project: 'shop',
    concept: 'regex-groups', conceptLabel: 'Named capture groups',
    code: 'const ISO_DAY = /^(?<y>\\d{4})-(?<m>\\d{2})-(?<d>\\d{2})$/;\n\nexport function parseDay(input: string): Date | null {\n  const m = ISO_DAY.exec(input.trim());\n  if (!m?.groups) return null;\n  const { y, m: month, d } = m.groups;\n  return new Date(Number(y), Number(month) - 1, Number(d));\n}' },
  { daysAgo: 11, hour: 9, minute: 40, outcome: 'understood', language: 'javascript', sourceApp: 'Cursor', file: 'src/cart/coupon.js', project: 'shop',
    concept: 'optional-chaining', conceptLabel: 'Optional chaining with a default',
    code: 'export function applyCoupon(order) {\n  const rate = order.coupon?.percent ?? 0;\n  const capped = Math.min(rate, 50);\n  const discount = Math.round(order.subtotal * capped) / 100;\n  return { ...order, discount, total: order.subtotal - discount };\n}' },
  { daysAgo: 12, hour: 14, minute: 55, outcome: 'understood', language: 'python', sourceApp: 'Cursor', file: 'etl/batch.py', project: 'etl',
    concept: 'generators', conceptLabel: 'Batching with a generator',
    code: 'def batches(items, size=100):\n    batch = []\n    for item in items:\n        batch.append(item)\n        if len(batch) == size:\n            yield batch\n            batch = []\n    if batch:\n        yield batch' },
];
const events = SAMPLES.map((s) => {
  const ts = at(s.daysAgo, s.hour, s.minute);
  return {
    id: randomUUID(), ts: ts.toISOString(), eventType: 'explanation_completed', localDate: dayKey(ts), timezone: tz,
    scope: 'selection', level: 'intermediate', outcome: s.outcome, lines: s.code.split('\n').length,
    language: s.language, sourceApp: s.sourceApp, file: s.file, project: s.project, concept: s.concept, conceptLabel: s.conceptLabel,
    code: s.code, ...(s.explanation ? { explanation: s.explanation } : {}), ...(s.answeredToday ? { answeredOn: [dayKey(new Date())] } : {}),
  };
});

// --- The app ------------------------------------------------------------------------------------------------------
const runtimeErrors = [];
const ours = (url) => !/^https?:/.test(url);
const watch = (page) => {
  page.on('console', (msg) => { if (msg.type() === 'error' && ours(page.url())) runtimeErrors.push(`console ${page.url().split('/').pop()}: ${msg.text()}`); });
  page.on('pageerror', (err) => { if (ours(page.url())) runtimeErrors.push(`pageerror ${page.url().split('/').pop()}: ${err.message}`); });
};
let app = null;
async function start() {
  const env = { ...process.env, UNVIBE_USER_DATA: dir };
  for (const key of Object.keys(env)) {
    if (/^(UNVIBE_ADMIN_STATS_TOKEN|UNVIBE_QA_FLAG_TOKEN|GITHUB_TOKEN|GH_TOKEN|ACTIONS_.*)$/.test(key)) delete env[key];
  }
  const args = [...(appDir ? [appDir] : []), ...(os === 'linux' ? ['--use-mock-keychain'] : [])];
  app = await launchApp({ exe, userData: dir, args, env, timeout: 90000 });
  app.onWindow(watch);
  const main = await app.windowWith('companion.html', 60000);
  if (!main) throw new Error('the main window did not open');
  await main.waitForLoadState('domcontentloaded');
  return main;
}
const finish = async () => {
  log(runtimeErrors.length === 0, 'No console or uncaught errors in Unvibe windows', runtimeErrors.length ? `${runtimeErrors.length} found` : '');
  for (const e of runtimeErrors) report.push(`      ${e}`);
  if (app) writeFileSync(path.join(out, 'main-process.log'), app.output.join(''));
  await app?.close().catch(() => {});
  writeFileSync(path.join(out, 'report-hero.txt'), `Unvibe Today still for the site hero (${os})\n\n${report.join('\n')}\n`);
  process.exit(report.some((l) => l.startsWith('FAIL')) ? 1 : 0);
};

try {
  // The lessons, the QA id and "launch at login was asked" go in before the first launch (the store is read once, at
  // start); the settings go through the app's own IPC, then a second launch opens Today as a returning person would.
  mkdirSync(dir, { recursive: true });
  // The local free-trial counter matches the lessons (one selected-code explanation each), started on the first one's day.
  writeFileSync(path.join(dir, 'unvibe-store.json'), JSON.stringify({
    installId, events, outbox: [], loginPromptAsked: true,
    betaPromptUsage: { selectedCodePrompts: events.length }, trialStartedAt: at(SAMPLES.at(-1).daysAgo, 9, 0).toISOString(),
  }));
  note('Profile', `${events.length} sample lessons over the last ${SAMPLES.at(-1).daysAgo + 1} days (${events.filter((e) => e.outcome === 'understood').length} understood, ${events.filter((e) => e.outcome === 'needs_review').length} to revisit, ${events.filter((e) => e.outcome === 'reviewed').length} reviewed); install id ${installId}`);

  let companion = await start();
  const version = (await companion.evaluate(() => window.unvibe.appInfo())).version;
  await companion.evaluate(() => window.unvibe.setSettings({ onboarded: true, displayName: 'Sam', theme: 'light', startAnimation: false, density: 'comfortable', soundEffects: false }));
  await app.close();
  app = null;
  await sleep(1500);

  companion = await start();
  await companion.locator('.topbar__title').filter({ hasText: 'Today' }).first().waitFor({ timeout: 30000 });
  const settingsFile = path.join(dir, 'unvibe-settings.json');
  const s = existsSync(settingsFile) ? JSON.parse(readFileSync(settingsFile, 'utf8')) : null;
  const store = readStore(dir);
  log(s?.onboarded === true && s?.theme === 'light' && s?.startAnimation === false && store?.installId === installId && (store?.events?.length ?? 0) === events.length,
    `The released app${version ? ` ${version}` : ''} opens on Today as a returning person (light, sharks off, the sample lessons kept)`,
    `onboarded ${s?.onboarded}, theme ${s?.theme}, startAnimation ${s?.startAnimation}, lessons ${store?.events?.length}, id ${store?.installId}`);

  // Number count-ups and the first paint settle before the still; the pointer stays off the window (no hover).
  await sleep(4000);
  const cdp = await companion.context().newCDPSession(companion);
  let png;
  try {
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: SCALE, mobile: false });
    await sleep(2500);
    const page = await companion.evaluate(() => {
      const text = (sel) => document.querySelector(sel)?.textContent.replace(/\s+/g, ' ').trim() ?? null;
      const recent = [...document.querySelectorAll('[aria-labelledby="home-recent"] li, #home-recent ~ * li')].length;
      return {
        title: text('.topbar__title'),
        theme: document.documentElement.dataset.theme ?? null,
        sharks: document.querySelectorAll('.sharks-backdrop canvas').length,
        recentHeading: text('#home-recent'),
        recent,
        strip: text('#home-strip')?.length ? [...document.querySelectorAll('#home-strip ~ * [class*="strip"] *, #home-strip ~ * [data-level]')].map((el) => el.getAttribute('data-level')).filter((v) => v !== null) : [],
        upNext: text('#home-next ~ .m-box__meta') ?? text('.m-box__meta'),
        scroll: { h: document.scrollingElement.scrollHeight, vh: innerHeight },
        size: { w: innerWidth, h: innerHeight, dpr: devicePixelRatio },
      };
    });
    note('Today at the capture', JSON.stringify(page));
    log(page.title === 'Today' && page.theme !== 'dark' && page.sharks === 0, 'Today, light, no sharks canvas behind the cards', `title ${page.title}, theme ${page.theme ?? 'light (unset)'}, sharks canvases ${page.sharks}`);
    log(page.size.w === W && page.size.h === H && page.size.dpr === SCALE, `Viewport ${W}x${H} at ${SCALE}x`, `${page.size.w}x${page.size.h} dpr ${page.size.dpr}`);
    ({ data: png } = await cdp.send('Page.captureScreenshot', { format: 'png' }));
  } finally {
    await cdp.send('Emulation.clearDeviceMetricsOverride').catch(() => {});
    await cdp.detach().catch(() => {});
  }
  const buf = Buffer.from(png, 'base64');
  const file = `hero-today-${version ?? 'unknown'}-${os}-light-${W}x${H}@${SCALE}x.png`;
  writeFileSync(path.join(out, file), buf);
  // A PNG's width and height are the IHDR chunk's first two 4-byte fields (bytes 16-23).
  const pw = buf.readUInt32BE(16);
  const ph = buf.readUInt32BE(20);
  log(pw === W * SCALE && ph === H * SCALE, `The still is ${W * SCALE}x${H * SCALE} px`, `${file}: ${pw}x${ph}, ${buf.length} B`);
  // Also a plain Playwright still of the same window as the runner shows it (1x), for comparison only.
  await companion.screenshot({ path: path.join(out, 'today-window-1x.png'), animations: 'disabled' }).catch((e) => note('1x still', `not taken (${short(e)})`));
} catch (e) {
  log(false, 'Hero still', short(e));
}
await finish();
