// IndexNow: tell Bing, Yandex, Seznam and Naver which unvibe.site URLs are new or changed, right after a
// production deploy (Google doesn't use IndexNow; it reads the sitemap). The key file is
// public/<key>.txt (a 32-hex name whose content is the same string), a public-safe random string, not a secret (IndexNow's own design:
// the engines fetch it to prove the host is ours).
//
// What it submits, from the live site (never from the working tree, so a failed deploy submits nothing):
//   1. every URL in https://unvibe.site/sitemap.xml that was not in the previous run's list (new pages);
//   2. URLs whose page source changed between the previous deployed commit and this one, mapped from
//      marketing/src/app/<route>/page.tsx (route groups and dynamic segments are skipped: /explain/* changes
//      come from the data file, so a change to src/lib/explainPages.ts submits the whole /explain set);
//   3. "/" when anything under marketing/src/site/ changed (the homepage is built from there).
// Each candidate must answer 200 on the live site, else it is left out (never submit a URL that 404s).
//
// Usage (from marketing/):
//   node scripts/indexnow.mjs --prev-urls <file> --prev-sha <sha> --sha <sha> [--dry-run]
//   node scripts/indexnow.mjs --all [--dry-run]           # submit the whole live sitemap (first run, or a reset)
// Prints the submitted list and writes it to --out (default .indexnow/submitted.txt) for the next run.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const SITE = "https://unvibe.site";
const HOST = "unvibe.site";
const ENDPOINT = "https://api.indexnow.org/IndexNow";
/** The IndexNow key file in public/: a 32-hex-character name whose content is the same string. One source. */
const KEY = (() => {
  const name = readdirSync("public").find((f) => /^[0-9a-f]{32}\.txt$/.test(f));
  if (!name) throw new Error("no IndexNow key file in public/ (<key>.txt)");
  const key = readFileSync(`public/${name}`, "utf8").trim();
  if (key !== name.slice(0, -4)) throw new Error(`public/${name} does not contain its own name`);
  return key;
})();

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const dryRun = flag("--dry-run");
const out = opt("--out") ?? ".indexnow/submitted.txt";

async function liveSitemap() {
  const res = await fetch(`${SITE}/sitemap.xml`);
  if (!res.ok) throw new Error(`sitemap.xml ${res.status}`);
  const xml = await res.text();
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
}

function changedFiles(prevSha, sha) {
  if (!prevSha || !sha) return [];
  try {
    return execFileSync("git", ["diff", "--name-only", `${prevSha}..${sha}`], { encoding: "utf8" }).split("\n").filter(Boolean);
  } catch (error) {
    console.warn(`git diff ${prevSha}..${sha} failed (${error.message}); submitting new sitemap URLs only`);
    return [];
  }
}

/** marketing/src/app/foo/bar/page.tsx → /foo/bar; the root page → /; dynamic and group segments → null. */
function routeOf(file) {
  const m = file.match(/^marketing\/src\/app\/(.*?)\/?page\.tsx$/);
  if (!m) return null;
  const route = m[1];
  if (route.includes("[") || route.includes("(")) return null;
  return route === "" ? "/" : `/${route}`;
}

function candidates(sitemap, prevUrls, files) {
  const set = new Set(sitemap.filter((u) => !prevUrls.has(u)));
  for (const file of files) {
    const route = routeOf(file);
    if (route) set.add(`${SITE}${route}`);
    if (file === "marketing/src/lib/explainPages.ts") for (const u of sitemap) if (u.includes("/explain/")) set.add(u);
    if (file.startsWith("marketing/src/site/") || file.startsWith("marketing/src/app/layout.tsx")) set.add(`${SITE}/`);
  }
  return [...set].filter((u) => sitemap.includes(u));
}

async function alive(url) {
  try {
    const res = await fetch(url, { method: "HEAD", redirect: "manual" });
    return res.status === 200;
  } catch {
    return false;
  }
}

async function submit(urls) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ host: HOST, key: KEY, keyLocation: `${SITE}/${KEY}.txt`, urlList: urls }),
  });
  return res.status;
}

const sitemap = await liveSitemap();
let urls;
if (flag("--all")) {
  urls = sitemap;
} else {
  const prevFile = opt("--prev-urls");
  const prevUrls = new Set(prevFile ? readFileSync(prevFile, "utf8").split("\n").filter(Boolean) : []);
  if (!prevFile) console.warn("no --prev-urls: every sitemap URL counts as new");
  const wanted = candidates(sitemap, prevUrls, changedFiles(opt("--prev-sha"), opt("--sha")));
  const checks = await Promise.all(wanted.map(alive));
  urls = wanted.filter((_, i) => checks[i]);
  for (const [i, u] of wanted.entries()) if (!checks[i]) console.warn(`skipped (not 200): ${u}`);
}

console.log(`${urls.length} URL(s) to submit${dryRun ? " (dry run)" : ""}:`);
for (const u of urls) console.log(`  ${u}`);
if (urls.length && !dryRun) {
  const status = await submit(urls);
  console.log(`IndexNow HTTP ${status}`);
  if (status !== 200 && status !== 202) process.exit(1);
}
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${sitemap.join("\n")}\n`);
