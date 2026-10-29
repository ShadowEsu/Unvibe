// After `next build`: every prerendered public page must declare itself as canonical, so Google never
// folds a page into another one (27 Oct: 11 live pages pointed at the homepage). Pages that are noindex or
// disallowed in the built robots.txt may have no canonical, but one that has a canonical must still point at
// itself. The Organization schema must list only profiles that exist (no TikTok until the account does), and
// no <title> may say "Unvibe" twice (a title that names the brand must skip the layout's "%s · Unvibe").
//
// Run from marketing/:  npm run build && node scripts/check-canonicals.mjs
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const SITE = "https://unvibe.site";
const appDir = join(process.cwd(), ".next/server/app");

function htmlFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return htmlFiles(p);
    return name.endsWith(".html") ? [p] : [];
  });
}

let files;
try {
  files = htmlFiles(appDir);
} catch {
  console.error(`No build output at ${appDir}. Run \`npm run build\` first.`);
  process.exit(2);
}

/**
 * Disallow paths from the `User-agent: *` group only. A rule for one crawler (say GPTBot `Disallow: /`)
 * says nothing about search engines and must not switch this check off. Consecutive User-agent lines
 * share one group; an empty Disallow allows everything.
 */
function starDisallows(text) {
  const paths = [];
  let agents = [];
  let inRules = false;
  for (const raw of text.split(/\r?\n/)) {
    const field = /^\s*([A-Za-z-]+)\s*:\s*(.*?)\s*$/.exec(raw.replace(/#.*/, ""));
    if (!field) continue;
    const [, key, value] = field;
    if (key.toLowerCase() === "user-agent") {
      if (inRules) { agents = []; inRules = false; }
      agents.push(value);
    } else {
      inRules = true;
      if (key.toLowerCase() === "disallow" && value && agents.includes("*")) paths.push(value);
    }
  }
  return paths;
}

let disallowed = [];
try {
  disallowed = starDisallows(readFileSync(join(appDir, "robots.txt.body"), "utf8"));
} catch {
  console.error("No built robots.txt: every page is treated as public.");
}

const failures = [];
let checked = 0;
for (const file of files) {
  const rel = relative(appDir, file).split(sep).join("/").replace(/\.html$/, "");
  if (rel === "_not-found" || rel.startsWith("_")) continue;
  const route = rel === "index" ? "/" : `/${rel}`;
  const html = readFileSync(file, "utf8");
  const canonicals = [...html.matchAll(/<link rel="canonical" href="([^"]*)"/g)].map((m) => m[1]);
  const noindex = /<meta name="robots" content="[^"]*noindex/.test(html) || disallowed.some((p) => route.startsWith(p));
  const want = route === "/" ? SITE : `${SITE}${route}`;
  checked += 1;
  if (canonicals.length > 1) failures.push(`${route}: ${canonicals.length} canonical tags`);
  else if (canonicals.length === 0 && !noindex) failures.push(`${route}: no canonical`);
  else if (canonicals.length === 1 && canonicals[0] !== want) failures.push(`${route}: canonical ${canonicals[0]}, want ${want}`);
  for (const sameAs of html.matchAll(/"sameAs":\[([^\]]*)\]/g)) {
    if (/tiktok/i.test(sameAs[1])) failures.push(`${route}: schema sameAs lists TikTok`);
  }
  const title = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? "";
  if ((title.match(/Unvibe/g) ?? []).length > 1) failures.push(`${route}: title says Unvibe twice: ${title}`);
}

if (checked === 0) failures.push("no prerendered pages found");
for (const f of failures) console.error(`FAIL ${f}`);
console.log(`check-canonicals: ${checked} pages, ${failures.length} failing`);
process.exit(failures.length ? 1 : 0);
