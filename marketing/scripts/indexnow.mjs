// IndexNow: tell Bing, Yandex, Seznam and Naver which unvibe.site URLs are new or changed, right after a
// production deploy (Google doesn't use IndexNow; it reads the sitemap). The key file is public/<key>.txt (a 32-hex
// name whose content is the same string), a public-safe random string, not a secret (IndexNow's own design: the
// engines fetch it to prove the host is ours).
//
// No state between runs: everything comes from the live sitemap and from git at two commits, the previous
// successful production deploy (--prev-sha, from the Deployments API) and this one (--sha).
// What it submits, from the live site (never from the working tree, so a failed deploy submits nothing):
//   1. every URL in https://unvibe.site/sitemap.xml that did not exist at the previous commit (new pages: a static
//      route whose page.tsx was not there, an /explain/<id> whose id was not in src/lib/explainPages.ts, a
//      /use-cases/<slug> whose slug was not in src/lib/useCases.ts);
//   2. URLs whose page source changed between the two commits, mapped from marketing/src/app/<route>/page.tsx
//      (route groups and dynamic segments are skipped: /explain/* and /use-cases/* changes come from their data
//      files, so a change to explainPages.ts or useCases.ts submits that whole set);
//   3. the homepage when anything under marketing/src/site/ or the root layout changed (it is built from there).
// Each candidate must answer 200 on the live site, else it is left out (never submit a URL that 404s).
//
// Usage (from marketing/, in a checkout that has both commits):
//   node scripts/indexnow.mjs --prev-sha <sha> --sha <sha> [--dry-run]
//   node scripts/indexnow.mjs --all [--dry-run]           # submit the whole live sitemap (manual reset only)
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";

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

async function liveSitemap() {
  const res = await fetch(`${SITE}/sitemap.xml`);
  if (!res.ok) throw new Error(`sitemap.xml ${res.status}`);
  const xml = await res.text();
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
}

/** Only full commit SHAs reach git: the args come from a workflow env and the Deployments API, never from a user. */
const isSha = (s) => /^[0-9a-f]{40}$/.test(s ?? "");

const git = (...a) => execFileSync("git", a, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });

function changedFiles(prevSha, sha) {
  try {
    return git("diff", "--name-only", `${prevSha}..${sha}`).split("\n").filter(Boolean);
  } catch (error) {
    throw new Error(`git diff ${prevSha}..${sha} failed (${error.message}); is the checkout deep enough for both commits?`);
  }
}

/** The file's text at a commit, or null when it did not exist there. */
function fileAt(sha, path) {
  try {
    return git("show", `${sha}:${path}`);
  } catch {
    return null;
  }
}

/** marketing/src/app/foo/bar/page.tsx → /foo/bar; the root page → ""; dynamic and group segments → null. */
function routeOf(file) {
  const m = file.match(/^marketing\/src\/app\/(.*?)\/?page\.tsx$/);
  if (!m) return null;
  const route = m[1];
  if (route.includes("[") || route.includes("(")) return null;
  return route === "" ? "" : `/${route}`;
}

/** The sitemap's own form of a route: the root is `https://unvibe.site`, no trailing slash. */
const urlOf = (route) => `${SITE}${route}`;

/** Did this live URL exist at `sha`? Decided from the sources the sitemap is built from (src/app/sitemap.ts). */
function existedAt(sha, url, at) {
  const route = url.slice(SITE.length);
  if (route === "") return true;
  const explain = route.match(/^\/explain\/([^/]+)$/);
  if (explain) return (at.explain ??= fileAt(sha, "marketing/src/lib/explainPages.ts") ?? "").includes(`id: "${explain[1]}"`);
  const useCase = route.match(/^\/use-cases\/([^/]+)$/);
  if (useCase) return (at.useCases ??= fileAt(sha, "marketing/src/lib/useCases.ts") ?? "").includes(`slug: "${useCase[1]}"`);
  return fileAt(sha, `marketing/src/app${route}/page.tsx`) !== null;
}

function candidates(sitemap, prevSha, files) {
  const at = {};
  const set = new Set(sitemap.filter((u) => !existedAt(prevSha, u, at)));
  for (const file of files) {
    const route = routeOf(file);
    if (route !== null) set.add(urlOf(route));
    if (file === "marketing/src/lib/explainPages.ts") for (const u of sitemap) if (u.includes("/explain/")) set.add(u);
    if (file === "marketing/src/lib/useCases.ts") for (const u of sitemap) if (u.includes("/use-cases")) set.add(u);
    if (file.startsWith("marketing/src/site/") || file === "marketing/src/app/layout.tsx") set.add(urlOf(""));
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
  const prevSha = opt("--prev-sha");
  const sha = opt("--sha");
  if (!isSha(prevSha) || !isSha(sha)) throw new Error(`--prev-sha and --sha must be full commit SHAs (got ${prevSha} / ${sha})`);
  const wanted = candidates(sitemap, prevSha, changedFiles(prevSha, sha));
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
