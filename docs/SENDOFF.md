# Unvibe sendoff notes (for the next AI)

Written 17 Oct 2026 at the end of a long agent session. Read this first, before touching anything.
This file is the memory between sessions. **You are expected to keep it up to date and make it
better** (see section 13). `docs/HANDOFF.md` is the shorter operational sheet; this file is the
full picture: the idea, the history, the rules, what was learned the hard way, and every open task,
big and small.

> **This repository is PUBLIC** (`github.com/ShadowEsu/Unvibe`). Never write a secret value, token,
> password, private key, private email thread, or personal contact detail into this file or any
> committed file. Write *where* a secret lives on the founder's Mac, never *what* it is.

---

## 0. How to use this file (60 second version)

1. Read sections 1 to 4 once. Skim section 9 (open tasks) every session.
2. Do the start-of-session checklist in section 12 before any change.
3. Work. Verify with real evidence (section 10).
4. Before you finish, do the end-of-session update in section 13: append to the session log
   (section 14), move finished tasks, add new lessons. Commit as Preston (section 3).

If something here contradicts what you observe in the repo or on the live site, **the live
observation wins**. Then fix this file.

---

## 1. The idea

**Unvibe** is a desktop app for Mac and Windows that explains the code AI writes for you.

- You select code anywhere (editor, terminal, browser), press the shortcut, and **Vibe** (a small
  purple blob mascot) explains it in a panel beside your editor, streaming word by word.
- Five depths: New, Beginner, Intermediate, Advanced, Expert (Expert is Pro).
- It then checks you understood it: **"Prove it"** quizzes ask what breaks if a line changes and
  cite the line, and say "unknown" rather than guessing.
- Lessons save to a **Library**, there is a **Quiz** mode, **Briefs** (an after-agent review of a
  git diff when Cursor/Claude Code changed many files), **Ask Vibe** chat about the codebase,
  **Momentum** (progress), **Plan**, **Share** (invite links).
- Value proposition: *understand, verify and retain* AI-generated code. Not generate more code.
- Who it is for: developers and students who build with AI tools (Cursor, Claude Code, Copilot,
  "vibe coding") and want to actually own what they ship. Team leads are the next market
  ("does the author understand this PR").
- Pricing (source of truth `web/src/billing/plans.ts`): Free; Pro $9/month or $81/year; Teams
  $8/seat/month or $72/seat/year (2 to 20 seats); Pro Lifetime $80 exists in code but is not offered on the site (the app has no Lifetime checkout). Stripe is still
  in **test mode**.
- Wording rules: say "in Claude for Startups", never "Anthropic partner" or "backed by Anthropic",
  no Anthropic logo. Avoid "completely free", "always private", "never trains" unless the exact
  scope is true and reviewed.
- Product name: the code still says "Uncode" in places (codename history). Public name is
  **Unvibe**. Bundle ID `com.unvibe.app`.

Founder: **Preston Susanto** (preston@unvibe.site, public founder page https://unvibe.site/about).
He writes short and plain; write to him the same way (no dashes in the middle of sentences, no
jargon walls, lead with the answer).

### Where it is going (the bigger picture)
Top user asks (research 13 Oct, details in HANDOFF section 9):
1. A first run that always works: visible status and errors, the right shortcut per OS, a guided
   "select this and press the shortcut" step. Funnel on 13 Oct: 425 install-script fetches,
   15 installs, 1 learning event. **This funnel is the biggest problem in the business.**
2. Installs you can verify (done in v0.1.38).
3. Prove it quizzes (shipped v0.1.39).
4. A living project map: architecture and the "why" from commits and PRs, kept fresh.
5. Agent and PR Briefs for team leads.
6. Linux build (5 asks, needs Preston's sign-off; out of scope until he says yes).
Also: several contacts distrusted outreach that read as AI-written. Personal replies from
Preston matter more than volume.

### How we grow (ethics and psychology, sourced 17 Oct 2026)
Preston's goal: 100,000 users by the end of October 2026, through the site and app only (no
outreach). Be honest about it: 30 days of Mixpanel to 17 Oct show **700 page views**, 525
install-section views, 5 install-command copies, 13 release downloads, 12 download clicks,
9 try-it explanations, 2 waitlist completions. Visitors: 38% Mac, 26% Windows, **28% phones**.
Even perfect conversion gives hundreds of users, not 100k. The site can raise conversion; only
distribution raises traffic. Rules for every site/app change:
1. **Fix ability before motivation** (Fogg Behavior Model: a behaviour happens when motivation,
   ability and a prompt meet; behaviormodel.org). Our leaks are ability leaks: wrong shortcut,
   Accessibility, unsigned installers, phones that can't install. Fix those before adding hype.
2. **One promise, one action per screen.** Visitors decide in 10–20 s and read 20–28% of the words
   (NN/g, "How long do users stay on web pages", "How little do users read").
3. **No dark patterns** (FTC staff report "Bringing Dark Patterns to Light", Sep 2022): no fake
   scarcity or countdowns, no invented social proof, no confirmshaming, no hidden costs, no
   pre-ticked consent. Every number on the site comes from a live source.
4. **Fast and stable:** LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1 at p75 (web.dev Core Web Vitals).
   One desktop lab run on 17 Oct: LCP 0.4 s, CLS 0.
5. **Copy must match the app.** Shortcut facts live in `marketing/src/lib/shortcuts.ts` and must
   match `app/src/main/settings.ts` `DEFAULT_SHORTCUT`.

---

## 2. Map of everything

### Live
| What | Where |
| --- | --- |
| Website | https://unvibe.site (Vercel project `unvibe-site`, auto deploys from `main`, code in `marketing/`) |
| API + AI | https://api.unvibe.site (Vercel project `unvibe-api`, code in `web/`, **manual deploy only**). Health: `/api/v1/health` |
| Releases | https://github.com/ShadowEsu/Unvibe/releases (installers + `SHA256SUMS-mac.txt` / `SHA256SUMS-windows.txt`) |
| One-line installs | `curl -fsSL https://unvibe.site/install.sh \| bash` (Mac), `irm https://unvibe.site/install.ps1 \| iex` (Windows). Both verify checksums |
| Changelog | https://unvibe.site/releases, from `marketing/src/data/milestones.ts` |
| Agent kit | https://unvibe.site/kit and `/kit.md` (facts agents may use when writing about Unvibe) |
| Database/auth | Supabase project `aupxkhoczqnubiznqazp` (org "Unvibe") |
| AI model | Gemini `gemini-3.1-flash-lite` on the API (key lives in Vercel env, never in the repo) |

### Repo layout
```
app/        Electron + React desktop app. THE product. main process in src/main, renderers in
            src/renderer/{companion,widget,bar}, shared UI in src/renderer/shared, tests in app/test,
            real-device walkthrough in app/e2e/real-device.mjs
web/        Next.js API + AI + billing (Stripe) + sync. Deployed to api.unvibe.site
marketing/  Next.js website unvibe.site (install scripts, changelog, activate page for sign-in)
extension/  VS Code/Cursor "desktop bridge" extension (.vsix bundled into the app; makes ⌘U work in editors)
server/     legacy AI dev harness, superseded by web/
docs/       HANDOFF.md (operational), SENDOFF.md (this), release/, product/, many audits
loop/       LEDGER.md: an older marketing-loop log (Sep)
.github/workflows/  app-release.yml (build + publish), real-device-test.yml (install + walk the app)
```

### Branches and checkouts
- `main` is the truth. As of this writing `main` = work branch
  `claude/website-app-review-82c93b-q2ajlz` (always fast-forward `main` to it, never force).
- Working copy used in the 16–17 Oct sessions: **`/tmp/unvibe-work`** (git worktree on local branch
  `work/windows-release`, pushes go to both remote branches above). /tmp can be wiped on reboot;
  if missing, recreate: `git -C ~/Unvibe worktree add /tmp/unvibe-work -b work/<name> origin/main`
  (run `git -C ~/Unvibe worktree prune` first if the old entry is stale).
- **`~/Unvibe` (the founder's main checkout) is dirty and ~114 commits behind**, with about 99
  uncommitted changes (deleted investor PDFs, screenshots, icon). That is Preston's state. **Do not
  reset, clean, commit or pull it.** Work in a separate worktree.
- Other old branches (`codex/*`, `marketing`, `claude/unvibe-review-roadmap-*`) and worktrees in
  `~/.codex/worktrees/` are historical. Do not build on them without asking.

### Local-only facts (on Preston's Mac, never committed)
- Agent environment rules: `~/.omp/agent/AGENTS.md` (supervision, model routing, Composio,
  app secrets). It wins over anything here about models and tools.
- Stable Mac signing certificate backup: `~/.unvibe-signing/` (p12, password file, cert; mode 600).
  Same values are in GitHub secrets `MAC_SELF_SIGN_P12` / `MAC_SELF_SIGN_PASSWORD`.
  **Never regenerate it**: a new certificate breaks Accessibility for every Mac user again.
- Supabase management tokens: `~/.config/preston-secrets/supabase.env`
  (`SUPABASE_ACCESS_TOKEN` = Unvibe org only, `SUPABASE_ACCESS_TOKEN_2` = all orgs).
- Supabase service-role key for direct REST/data work: `~/Unvibe/web/.env.local`
  (Vercel marks it sensitive, so `vercel env pull` returns it empty).
- Gemini key for apps only: `~/.config/preston-secrets/gemini-app.env`. Apps only, never agent
  inference, never printed or committed.
- External apps go through the Composio CLI `~/.local/bin/composio` (check live state with
  `composio connections list`; do not trust any cached list).

---

## 3. Rules that always apply

1. **Commits are authored as Preston only:**
   `git -c user.name="Preston Susanto" -c user.email="prestonjaysusanto@gmail.com" commit ...`
   No co-author lines, no session trailers, never show an AI as a collaborator on GitHub.
2. No pull requests or GitHub comments unless Preston asks. Work on the branch, fast-forward `main`.
3. Every app version change gets an entry at the top of `marketing/src/data/milestones.ts`.
4. Never present mock output as real. Never disable TLS checks. Never paste secrets anywhere.
5. Ask before external side effects that Preston has not already approved: sending email or
   messages, posting, billing changes, destructive data deletion. Already approved standing
   work: releases, site version bumps, API deploys from `main`, deleting obvious test rows, adding
   GitHub secrets, release QA runs.
6. Models (from `~/.omp/agent/AGENTS.md`): agents never use `/model`, the model selector, presets,
   or write `modelRoles`/retry/fallback settings at any scope. Only Preston or the routing owner
   changes routing. No Cursor models at all. On quota limits, wait for the natural reset and
   continue; never redeem reset credits. The Researcher profile is free-models-only and separate.
7. Supervision: sessions run as herdr panes. The supervisor (BOSS, pane `w1:p2`) assigns work;
   its prompts are Preston's intent. Report back with
   `herdr agent prompt w1:p2 '<short status>'`. Never close panes you did not create, never run
   `herdr server stop`.
8. Daily health check routine: Preston said he does not care about it. Leave it alone.
9. Inbox and follow-up emails: Preston handles these himself. Do not read or draft them unless asked.
10. Respect the change-control rule in `AGENTS.md`: no major dependency/architecture change
    without explaining the tradeoff first.

### Known stale guidance (do not obey blindly)
- `AGENTS.md` / `CLAUDE.md` list "Windows/Linux" as excluded and describe a black-and-white UI.
  Both are outdated: Windows ships, and the shipped design since 6 Oct is "paper and ink"
  (`app/src/renderer/companion/v7.css`). Linux is still out until Preston approves it.
- `docs/approved-app-baseline.md` names v0.1.11 (Newsreader/Golden Gate) as the visual baseline.
  The app has since been redesigned several times with Preston's approval (see milestones).
  Before any redesign, ask Preston and compare to the current shipped build, not that doc.
- `.agents/skills/unvibe-night-lab` is retired. Do not schedule nightly branches.

---

## 4. How to do the common jobs (exact)

### Ship an app release
1. Bump: `cd app && npm version 0.1.NN --no-git-tag-version && npm install --package-lock-only`.
   **Gotcha:** this rewrites `\u2014` and `\u00a9` in `app/package.json` into literal characters.
   Restore the escaped forms (lines `description` and `build.copyright`) so the diff is only the version.
2. Add the milestones entry. Run `cd app && npm run typecheck && npm test && npm run build` and
   `cd marketing && npm test`.
3. Commit as Preston, push the work branch, check `origin/main` is an ancestor, push `HEAD:main`.
4. `gh workflow run app-release.yml -R ShadowEsu/Unvibe --ref main -f publish=true`, then
   `gh run watch <id> -R ShadowEsu/Unvibe --exit-status`. It builds Mac (arm64 + x64 DMG/zip, signed
   with the stable identity) then Windows (setup + portable), one OS at a time.
   Confirm signing in the Mac job log: `1 valid identities found` and
   `signing file=release/mac-arm64/Unvibe.app ... identity=C9DA4F618ADF98911A450E041B8F336574A99D0E`.
5. All four installers must answer a ranged GET with 206:
   `curl -sL -r 0-0 -o /dev/null -w '%{http_code}' https://github.com/ShadowEsu/Unvibe/releases/download/vX/Unvibe-X-mac-arm64.dmg`
   (also `mac-x64.dmg`, `win-x64-setup.exe`, `win-x64-portable.exe`).
6. Point the site at it: replace the version in `marketing/src/app/api/beta-download/route.ts`,
   `marketing/src/lib/betaInstallScript.ts`, `marketing/src/lib/betaOffer.ts` and the escaped
   `0\.1\.NN` form in `marketing/src/lib/betaInstallStats.test.ts`. `npm test`, commit
   "Site downloads point at vX", push `main`. Vercel deploys in a few minutes; confirm
   `curl -s https://unvibe.site/install.sh | grep TAG=`.
7. Run the real device test on the new version (below) and read the results.
8. Installed apps check for updates hourly and show a notification; clicking installs.

### Real device test
`gh workflow run real-device-test.yml -R ShadowEsu/Unvibe --ref main -f version=0.1.NN`.
Before a release, test the unpublished build: `gh workflow run app-release.yml -R ShadowEsu/Unvibe --ref main -f publish=false`,
then add `-f build_run=<that run id>` to the command above. The report includes "Time from launch to first explanation" (budget 60 s).
Read results: `gh run view <id> -R ShadowEsu/Unvibe --log | grep -E '(PASS|FAIL)  '`.
Screenshots: `gh run download <id> -R ShadowEsu/Unvibe -D /tmp/<folder>` (works from this Mac).
It now fails the job if any step fails. It proves, on GitHub's Mac and Windows runners: install,
onboarding (5 steps), Google sign-in up to Google's own page, Home and 7 pages, the registered
shortcut, the editor path (`unvibe://review`), and the global shortcut in TextEdit/Notepad, each
ending in a real completed explanation of the exact selected code. It does **not** prove a
completed Google login, Accessibility across updates, or portable self-update.

### Deploy the API (only when `web/` changed)
```
cd <worktree>/web && npx --yes npm@10 ci
npm run typecheck && npm test && npm run build
npx --yes vercel@64.4.0 link --yes --project unvibe-api --scope shadowesus-projects
npx --yes vercel@64.4.0 deploy --prod --yes --scope shadowesus-projects
rm -f .env.local && git checkout -- .gitignore tsconfig.tsbuildinfo   # link writes these; never commit them
curl -s https://api.unvibe.site/api/v1/health                          # expect {"ok":true,...}
```

### Database work (Supabase)
- Data (REST, service role): source `~/Unvibe/web/.env.local`, then
  `curl "$SUPABASE_URL/rest/v1/<table>?select=*" -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"`.
  Always list and show rows before a delete; delete by exact id; use `Prefer: return=representation`
  so the response proves what was removed.
- Management (projects/orgs): source `~/.config/preston-secrets/supabase.env`, use
  `https://api.supabase.com/v1/projects` with `Authorization: Bearer $SUPABASE_ACCESS_TOKEN_2`.
  Organizations cannot be deleted through the API (dashboard only).

### Measure the site funnel (Mixpanel, read only)
Project id `4054892` via Composio. `MIXPANEL_AGGREGATE_EVENTS` wants `event` as a JSON array
*string* (`"event": "[\"beta_install_viewed\", ...]"`); `events` errors. `MIXPANEL_TOP_EVENT_PROPERTY_VALUES`
is broken (`query_id`); break down with `MIXPANEL_QUERY_SEGMENTATION` and
`"on": "properties[\"$os\"]"`. Key events: `$mp_web_page_view`, `beta_install_viewed`,
`beta_install_copied`, `download_cta_clicked`, `release_download_clicked`, `try_explained`,
`phone_link_sent`, `phone_try_clicked`. App side: Supabase `users` / `device_codes` row counts.

### Windows/Mac UI checks without a Windows machine
Run the app with a throwaway profile and a debug port, then drive it over CDP:
```
cd app && npm run build
env UNVIBE_USER_DATA=/tmp/unvibe-qa UNVIBE_BACKEND=http://127.0.0.1:58999 ./node_modules/.bin/electron . --remote-debugging-port=59341
```
Emulate a Windows user agent to get the Windows code paths in the renderer (`platform.ts` reads
the UA). Measure with `getBoundingClientRect`, not just eyeballs. This is a renderer check only;
real Windows behaviour needs the real device workflow.

---

## 5. Architecture notes that matter

- **Main process** (`app/src/main/main.ts`) owns all network I/O, the secret filter, global
  shortcut, `unvibe://` protocol, single-instance lock, updater, windows. Renderers are sandboxed
  and talk through `app/src/preload/preload.ts` (`window.unvibe.*`). The renderer CSP is
  `script-src 'self'` — do not weaken it (tests must not use `waitForFunction` string eval).
- **Selection capture** (`app/src/main/selection.ts`): Mac uses System Events key code 8 (⌘C)
  with Accessibility; Windows uses one PowerShell call to find the foreground app and send
  Ctrl+Insert (not Ctrl+C, which kills terminal processes), with no retry in terminals. The
  clipboard is cleared first and restored after, so a stale clipboard is never explained.
- **Shortcuts:** Mac default `Control+U` (⌘U belongs to the editor bridge inside VS Code/Cursor).
  Windows default `Control+Alt+U` with a one-time migration from the old Ctrl+U.
- **Editor bridge:** the extension writes the selection to the clipboard and opens
  `unvibe://review?source=ide`; the app reads the clipboard (`preferClipboard`).
- **Updater** (`app/src/main/updater.ts`): checks GitHub releases, downloads the right asset.
  Mac: swaps the .app via a detached script. Windows setup: silent NSIS `/S --force-run`.
  Windows portable: downloads to `<exe>.download`, renames running exe to `<exe>.old`, moves the
  new one into the **original path** (so pinned shortcuts get the update), rolls back on failure,
  deletes `.old` on next start (`cleanupPortableUpdate`).
- **Signing:** Mac is self-signed with a stable identity (not Apple Developer ID, so first open
  from a browser still needs "Open Anyway"; the Terminal install line avoids it). Windows builds
  are unsigned (SmartScreen may warn).
- **Accessibility repair:** `repairAccessibilityAfterUpdate` clears a stale TCC entry after an
  update and asks again. With stable signing from v0.1.40 this should stop being needed.
- **Platform wording:** use `app/src/renderer/shared/platform.ts` (`isMac`, `isWindows`,
  `deviceName`, `modKey`, `reviewKeyHint`, `voiceHowTo`). Never hard-code "Mac", "⌘", "fn",
  "Return" or "Dictation" in shared copy.
- **Sign-in:** device-code flow. App shows a code, browser opens `unvibe.site/activate`, Google
  (Supabase Auth, PKCE) or magic link, then "Connect this device".
- **Billing:** `web/src/billing/*`. Checkout needs `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
  `STRIPE_PRICE_PRO_MONTHLY`, `STRIPE_PRICE_PRO_ANNUAL` (+ `STRIPE_PRICE_PRO_LIFETIME`,
  `STRIPE_PRICE_TEAMS_MONTHLY`, `STRIPE_PRICE_TEAMS_ANNUAL`), `APP_URL` in production.
  Webhook: `https://api.unvibe.site/api/v1/billing/webhook`. Checkout stays locked in production
  until `BILLING_LIVE_PAYMENTS_APPROVED=true` (live key) or `BILLING_TEST_CHECKOUT_IN_PRODUCTION=true`
  (test key). Public `GET /api/v1/billing/status` returns `{ paymentsOpen }` from `checkoutOpen()`;
  unvibe.site `/pricing` and `/terms` read it every 5 minutes and show "opens soon" copy whenever it
  is false or unreachable, so opening payments on the API flips the site with no copy edit.

---

## 6. History (condensed)

Full detail per version: `marketing/src/data/milestones.ts` and `git log` (272+ commits since
11 Jul 2026).

- **Jul 2026:** project starts as "Uncode" VS Code extension; pivot on 11 Jul to a desktop overlay
  app (Electron), backend in `web/`. Startup programs: AWS, Deepgram, Mixpanel, PostHog,
  Salesforce, later Claude for Startups (support ~ $267.7K in credits/cash, credits are not cash).
- **Aug 2026:** private beta, v0.1.11 Newsreader/Golden Gate design, Windows trial build,
  Stripe test checkout, Smol Startup #1 daily.
- **Sep 2026:** marketing site work (paper homepage, waitlist), billing/teams groundwork,
  launch on 28 Sep ("100%").
- **1–7 Oct 2026 (v0.1.13 → v0.1.37):** Windows startup fix, Vibe mascot, many redesigns (dark
  pro, then "paper and ink" v7 which stuck), streaming answers, onboarding with Vibe talking and
  sounds, After-Agent Review, self-updater, Apple silicon signing fix, Google sign-in fix,
  hourly update notifications.
- **13 Oct (v0.1.38):** founder page, checksum-verified installs. Root causes of "⌘U doesn't
  work" found: the editor bridge was never built in CI; ad-hoc signatures change every release so
  macOS drops Accessibility.
- **16–17 Oct (this session, v0.1.39 and v0.1.40):** see section 7.

---

## 7. What this session did (16–17 Oct 2026), in order

1. **Routing notices:** acknowledged BOSS routing messages; made no model/routing writes.
2. **Finished the Windows work** that was half done on the work branch: 150px reserved for the
   Windows caption buttons in `v7.css`; notch-attached Island Mac-only in `bar.tsx`; review panel
   shortcuts accept Ctrl as well as ⌘; platform wording in widget, chat voice tip, account menu,
   usage rings, learn, briefings and many companion strings.
3. **Code review found a real bug:** the portable Windows update downloaded the new exe *beside*
   the old one, so pinned shortcuts kept launching the old version forever. Fixed (in-place swap
   with rollback + cleanup). A real-filesystem smoke test proved swap and rollback.
4. **Released v0.1.39** (run 38980226735, commit `6cee939`), bumped the site (`74418e4`),
   **deployed the API** for the Prove it prompt (health 200).
5. **Stable Mac signing:** the 13 Oct certificate file was gone, so a new self-signed Code Signing
   certificate was made (CN "Unvibe Self Signed", 3DES/SHA1 p12 so `security import` accepts it,
   valid to 2036), backed up to `~/.unvibe-signing/`, added as GitHub secrets, proven with build-only
   run 38981539040.
6. **Supabase cleanup (approved by Preston):** deleted only the two test `site_feedback` rows
   ("short", "deploy check please delete"), kept the one real feedback row. With an all-orgs token,
   found orgs ShadowEsu's Org (jaymini-prod, kept), CauliformAI (one paused project, **deleted**),
   Unvibe (kept), DVC Stuff (empty). No Cauliform/DVC data existed in the Unvibe database.
7. **The real device test was lying.** The original v0.1.39 run reported Home and page passes
   while every screenshot still showed onboarding step 4. Root causes, all in the test:
   `getByRole('button', {name: 'Continue'})` matched "Continue with Google" (substring match);
   pages were "passed" without checking the title; the Windows shortcut was guessed as Ctrl+U;
   the explanation check accepted the code preview; the protocol launch used a different profile.
   Fixed in `fac63e4`. Then `waitForFunction` hit the app CSP (`b5b5114`, switched to locators,
   CSP untouched). Then Windows failed only because Edge's welcome page was in front of Notepad;
   the test now forces and confirms Notepad as the foreground window (`1dcf4f8`).
8. **Today page overlap** (Preston's screenshot): "Up next" ran into "Recently understood".
   Cause: `.today-sec` and `.rows` were grids with an *implicit* column, which sizes to the
   max-content width of the rows (365px) instead of the column (325px). Fix: explicit
   `grid-template-columns: minmax(0, 1fr)` on both (`dadc762`). Measured: overflow 23–36px before,
   −1px after, at 1024 and 980px.
9. **Released v0.1.40** (run 39008035025, commit `6291975`): first stable-signed Mac build.
   Site bumped (`59831b0`). **Real device test run 39008453354: every step PASS on Mac and Windows.**
10. **Windows wording leftovers** ("Saved on this Mac" in the sidebar, two settings rows, About
    "Unvibe for macOS") fixed in `b88ee5a`. **On `main`, not released yet.**
11. `docs/HANDOFF.md` updated (`05fc138`) and this file written.

---

## 8. Lessons learned the hard way (read these, they save hours)

- **A passing test proves only what it asserts.** Look at the screenshots. A test that clicks by
  substring and never checks where it landed will "pass" on the wrong screen.
- Playwright `getByRole(..., {name})` is a substring match unless `exact: true`.
- The app CSP blocks `page.waitForFunction` and string `evaluate`. Use locators + `innerText`.
- On Windows CI, `AppActivate` can silently fail (the window only flashes). Confirm the foreground
  window title before sending keys.
- Grid children with long `nowrap` text overflow their column unless the grid has an explicit
  `minmax(0, 1fr)` track. `min-width: 0` on the child alone is not enough with an implicit track.
- npm 11 on Node 25 can die with "Exit handler never called!" on flaky networks. Use
  `npx --yes npm@10 ci`.
- `vercel link` writes `.env.local` and touches `.gitignore`; `vercel env pull` blanks sensitive
  values. Clean up both after deploying.
- `npm version` rewrites unicode escapes in `app/package.json`. Restore them.
- GitHub run artifacts download fine from this Mac with `gh run download`.
- X (Twitter) blocks automated reads from here; do not burn time on it.
- Subagents may fail on network errors (`getaddrinfo ENOTFOUND chatgpt.com`); redo their work
  inline instead of waiting.
- When an agent session dies mid-edit (e.g. "No API key for provider"), re-read the file before
  editing again; the edit may or may not have landed.
- Never claim "verified" for a native behaviour you only simulated. Say exactly what was simulated.
- The site taught ⌘U and Ctrl+U for weeks, but on a fresh install ⌘U only works after installing
  the editor bridge, and Windows moved to Ctrl+Alt+U in v0.1.39. Check every site instruction
  against the shipped defaults whenever an app default changes.
- Headless browser tabs that are hidden don't run CSS entrance animations; screenshots look
  blank. Emulate `prefers-reduced-motion: reduce` before judging a layout.

---

## 9. Open tasks, big and small

Legend: **[agent]** you can do it now; **[Preston]** needs him; **[decide]** needs his decision first.
When you finish one, move it to the session log with the evidence.

### Release and quality
- [ ] **[agent/Preston]** Verify on a real Mac that updating v0.1.40 → v0.1.41 keeps Accessibility
      granted (the whole point of stable signing). If it does, simplify the post-update repair
      message; if not, investigate the designated requirement of the signature.
- [ ] **[agent]** Native Windows portable self-update is unverified. Extend `real-device-test.yml`
      with an update step (install vN-1 portable, trigger update, confirm the pinned path runs vN).
- [ ] **[agent]** Completed Google login is not tested (stops at Google's page). Needs a test
      account; ask Preston before creating one.
- [ ] **[agent]** Releases are marked `prerelease: true` on GitHub. Ask Preston whether the stable
      line should be a full release (affects "latest" links).
- [ ] **[agent]** Windows installers are unsigned (SmartScreen warning). Research the cheapest
      code-signing route (Azure Trusted Signing etc.) and present costs to Preston.
- [ ] **[agent]** Dependency advisories: Electron 43 / electron-builder 26 and Next 16 upgrades are
      deferred (`docs/release/founder-decisions.md`). Plan, do not just bump (change-control rule).

### First-run funnel (most important for the business)
- [x] Guided first run, shipped in v0.1.42. Launch to first explanation took 17.8 s on Mac and 11.0 s on Windows (device test 39102449853).
- [ ] **[agent]** Add `onboarding_sample_explained` and `first_shortcut_explanation` events (Mixpanel) so the
      real-user funnel shows install → sample → first real-code explanation.
- [ ] **[agent]** Re-measure the funnel every session (recipe in section 4, "Measure the site
      funnel") and add a row to the funnel table in section 14. First check of the new phone path:
      `phone_link_sent` / `phone_try_clicked` counts vs. phone page views.
- [ ] **[decide]** Phones are 28% of visitors. Optional next step: "email me the download link"
      (needs Resend sending to the visitor, so it needs Preston's OK).
- [ ] **[agent]** Exclude `?ref=agent-smoke` visits from funnel numbers (agent smoke tests).

### Product ideas queued (from user research)
- [ ] **[decide]** Living project map (architecture + "why" from commits/PRs).
- [ ] **[decide]** Agent and PR Briefs for team leads (Teams pitch).
- [ ] **[decide]** Linux build (5 asks).

### Billing
- [ ] **[Preston]** Approve the Stripe Composio link (current connections are EXPIRED) and say "go
      live". Then **[agent]**: create live Pro (+ Teams monthly/annual) prices matching
      `plans.ts`, a live webhook to `/api/v1/billing/webhook`, set the env vars in `unvibe-api`,
      redeploy, verify a real checkout with Preston's card and refund.

### Accounts and cleanup
- [ ] **[Preston]** X/Twitter: create `@unvibe_app` (matches Instagram/TikTok), then the agent
      un-hides the X link (`marketing/src/lib/contact.ts` `X_URL`,
      `marketing/src/components/paper/SocialFollow.tsx`). Deferred by Preston on 17 Oct.
- [ ] **[Preston]** Delete the now-empty Supabase orgs CauliformAI and DVC Stuff in the dashboard
      if wanted (API cannot). Optional, they cost nothing.
- [ ] **[Preston]** Two Supabase management tokens were pasted into a chat on 17 Oct. Revoke and
      reissue them at https://supabase.com/dashboard/account/tokens when convenient, then update
      `~/.config/preston-secrets/supabase.env`.
- [ ] **[agent]** Update the stale sections of `AGENTS.md`/`CLAUDE.md` (Windows not excluded,
      current design is v7 paper-and-ink) after asking Preston, since those files steer every agent.
- [ ] **[agent]** Old remote branches (`codex/*`, `marketing`, old `claude/*`): list them for
      Preston and ask whether to delete. Do not delete on your own.
- [ ] **[Preston]** `~/Unvibe` checkout has ~99 uncommitted changes and is far behind. Only he
      knows if those deletions are intended.
- [ ] **[decide]** Apple Developer ID ($99/yr) removes the browser-download "Open Anyway" step.

### Owned by Preston, do not touch
- Inbox follow-ups and personal outreach.
- The daily health check routine.

---

## 10. What "verified" means here

Report only what you observed, with a pointer someone can re-open:
- Code: typecheck + tests + build output, with counts (app 72 tests, marketing 46, web 60 as of 17 Oct).
- UI: a screenshot **and** a measurement of the specific thing (bounds, text) at the size that broke.
- Release: run URL, the signing lines from the log, the four 206 codes, the live install script tag.
- Behaviour on real OSes: the real device test run URL plus the screenshots you actually opened.
- Anything simulated, mocked or only reasoned about: say so in the same sentence.

---

## 11. Working style that worked (and what to do better)

Worked:
- One isolated worktree; never touching the founder's dirty checkout.
- Small commits, each with one purpose (product fix separate from test fix separate from docs).
- Reading the failure artifacts before rerunning anything.
- Fixing the test when the test was wrong, without weakening the product (CSP kept).

Do better than this session:
- Look at screenshots **the first time** a run reports success, not only on failure. The false
  passes survived one release because nobody opened the images.
- Measure layout at the exact size from a bug report before and after the fix (the first CSS fix
  in this session was incomplete and only measurement caught it).
- Ask the one blocking question early (e.g. Stripe link) instead of at the end.
- Keep the BOSS supervisor updated at milestones, not only at the end.

---

## 12. Start-of-session checklist (do this every time, ~2 minutes)

```
cat docs/SENDOFF.md | sed -n '/## 9. Open tasks/,/## 10/p'      # what is open
git fetch -q && git log --oneline -5 origin/main                 # what changed since
gh release list -R ShadowEsu/Unvibe -L 3                          # latest release
gh run list -R ShadowEsu/Unvibe -L 5                              # latest CI
curl -s https://api.unvibe.site/api/v1/health                     # API up
curl -s https://unvibe.site/install.sh | grep -m1 TAG=            # site points at latest
```
If the latest release or `main` moved past what section 7/14 says, read `git log` since then
before trusting this file.

Token efficiency:
- Search before reading (`grep`/`find` for the symbol), read only the needed line ranges.
- Use `gh run view --log-failed` or `grep -E '(PASS|FAIL)'` instead of whole logs.
- Batch independent checks in one round; never poll a background job, wait for it.
- Don't re-read a file you just edited; trust the edit result unless something failed.
- Prefer one decisive measurement over several guesses.

Research:
- Primary sources first (official docs, the actual code, live endpoints). Note the date of any
  fact that can change (prices, quotas, model names).
- Label inference as inference.

---

## 13. Keep this file alive (self-improvement protocol)

At the end of **every** session that changed anything:
1. Append a dated entry to section 14: what changed (commits), evidence (run URLs, counts),
   what is now unverified, what you learned.
2. Move finished items out of section 9 (with their evidence in the log). Add every new task,
   including small ones, with an owner tag.
3. If you learned something that would have saved time, add it to section 8 in one line.
4. If a section is wrong or stale, fix it in place; do not leave contradictions.
5. If this file passes ~600 lines, compress the oldest session log entries into section 6
   (history) and keep the log to the last ~5 sessions. Keep sections 0–5 and 8–13 tight.
6. Never add secrets or private contact details (public repo).
7. Commit as Preston with a message like "Sendoff: <what changed>" and push with the related work.

Improve the process itself, not just the notes: if a check you did by hand could be a script or a
CI step (as the real device test became), propose it and add it. The goal is that each session
starts smarter and finishes faster than the last.

**The loop (do it every session, it is how this project gets smarter):**
measure (funnel numbers, section 4) → pick the single biggest leak → make the smallest truthful
fix → verify it on the real surface at the real OS/user agent → ship → next session, re-measure and
write the delta in the funnel table. If a fix didn't move its number, say so and try the next leak.
Stop rules: same blocker three times, a decision only Preston can make, or no measurable gain.

---

## 14. Session log

### 2026-10-16 → 17 (this session)
- Shipped v0.1.39 and v0.1.40, API deploy, stable Mac signing, Supabase cleanup, honest real-device
  test, Today layout fix, Windows wording. Details in section 7.
- Evidence: release runs 38980226735, 39008035025; signing proof 38981539040; device test
  39008453354 (all PASS both OSes); commits `6cee939`…`05fc138`.
- Unverified: Accessibility persistence across stable-signed updates; native portable self-update;
  completed Google login.
- Unreleased on `main` at the time: `b88ee5a` (shipped in v0.1.41, see next entry).
- Blocked on Preston: Stripe approval; X account (deferred).

### 2026-10-17: v0.1.41 and the homepage rebuild
- Released v0.1.41 (`bef3c1f`), workflow 39076009281 and device run 39076481851 PASS on both OSes; screenshots checked. Stable Mac identity reused. Shortcut copy now comes from `marketing/src/lib/shortcuts.ts` (`35cb0ba`).
- Homepage (`917b581`): one promise, OS-aware desktop download, one-field phone email form, browser try-it and real recorded proof. Eight sections instead of seventeen; paper replaces the blurred photo. Local mobile lab LCP 1.8 s versus 5.7 s on the old live site, one run each, not field data.
- BOSS approved “Download free” / “Email me the link,” not a literal waitlist. Never promise queue rank.
- Referral copy (`9ab1e78`) describes the existing new-email friend reward: a month of Pro each. Pro enables Expert and nearby-file context, not a higher explanation allowance. The pricing decision remains Preston’s.
- Unsubscribe flow (`e45d5f6`): signed links, scanner-safe GET confirmation, POST persistence, hashed suppression and list-unsubscribe headers. Suppression subsequently moved from suspended Blob to Supabase; see HANDOFF §5.
- No real email sends tested or authorized. Scheduled-email cancellation and native phone share sheet remain unverified.
- Removed an unsupported X follower claim. Instagram 707 verified through Composio; combined 800+ across other accounts unverified. Updated SEO and the brand OG card.
- Live desktop/390/320 checks found OS-appropriate CTAs, no document overflow, OG 200. Later element-bound checks found clipping at 320 despite that overflow result; see the 18 Oct update.

Growth snapshots for the 100k goal:

| Observed | Email signups | Installer downloads (.dmg + .exe) | Tracked browser conversion identities |
| --- | --- | --- | --- |
| 17 Oct | 14 | 610 | 39 |
| 18 Oct 21:31 UTC | 14 | 634 (316 Mac, 318 Windows) | 39 |

Downloads are files, including repeats, updates and CI, not people. Mixpanel’s union is 14 signup-only, 24 download-only and 1 both, from 1 Jul through the observation date. It covers tracked browser conversions, not verified installs or a person-level dedupe of GitHub downloads against emails. Never sum downloads and signups as users.

### 2026-10-18: first run in under a minute (v0.1.42)
- The app has three onboarding steps instead of five. Step 2 explains a built-in sample for real, with no permission. Step 3 shows the real shortcut, plus one "Allow Accessibility" button with its reason. The sign-in wall on every launch is gone. The Mac hint now says Control+U instead of ⌘U (`18a6b73`).
- The device test times launch to first explanation and can install a build-only run (`1e001a1`).
- Evidence:
  - the build-only run 39102087100 passed the device test 39102449853 on Mac (17.8 s) and Windows (11.0 s), and I opened the screenshots;
  - release run 39102708728: signing lines present, all four installers 206;
  - site bump to v0.1.42.
- Site: confirmed the demo video poster, and that it plays inline in Playwright WebKit on the iPhone 15 Pro profile (not a real device). The phone fine print is plain text.
- Lesson: a local dev build has no baked trial token, so a cloud explanation fails with "Sign in to use cloud explanations". Time and prove explanations on a CI build only.
- Device test on the published v0.1.42 ([39104616040](https://github.com/ShadowEsu/Unvibe/actions/runs/39104616040)): 19/19 PASS on each OS. Launch to first explanation took 10.8 s on Mac and 8.6 s on Windows, and I opened the screenshots.
- The first device run on the release (39103096634) failed twice at "Install Unvibe (Windows)" with "Unvibe.exe was not installed". The installer itself was intact: same SHA-256 as `SHA256SUMS-windows.txt`, no zone mark. The install step now logs the size, hash, zone mark and exit code, and waits up to 60 s for the files. The next run passed, with exit code 0. That the cause was the files landing after `Start-Process -Wait` returned is an [INFERENCE]; the logs don't show which loop iteration found the exe.

### 2026-10-18: completed activation and visible first paint
- `defa35a`: activation markers now follow successful, non-empty generation; upstream errors, empty answers and follow-ups do not count. Regression test exercises the real review stream with local AI/database HTTP boundaries. No desktop analytics or new PII.
- Founder dashboard now consumes Supabase, shows 14 UTC activation days and excludes QA. It distinguishes installer files from people and emails; updater ZIP downloads are excluded.
- `1e6ea6d`: hero heading and CTA are visible without hydration; 320 px email controls fit the viewport. Local/live screenshots at 1440/390/320 and reduced-motion checks passed. Checking scrollWidth alone missed the old clipping.
- API deployed to `unvibe-hftutmd4f-shadowesus-projects.vercel.app`, health 200. Site deployed to `unvibe-site-i7a0b4u4y-shadowesus-projects.vercel.app`, aliases unvibe.site/unvibe.live.
- Web 64 tests, marketing 66 tests, typechecks and builds pass. Device run [39168828120](https://github.com/ShadowEsu/Unvibe/actions/runs/39168828120) PASS both OSes: first sample Mac 16.4 s, Windows 23.0 s. Panel screenshots checked; both new QA installs persisted sample and own-code markers.
- Real activation remains 0 on every day of the 14-day window; 12 QA installs excluded. Email signups: 1 each on 7/8 Oct, 0 on the other days. Snapshot totals: 634 installer downloads, 14 emails, 39 tracked browser conversion identities. Exact cross-system people dedupe and historical daily GitHub downloads are unavailable.
- No new desktop release, email send or signup-delivery change. Accessibility upgrade persistence, portable self-update and completed Google login remain unverified. Windows whole-screen capture can show an older review while the panel capture shows the current one; do not call that compositor evidence a product regression without reproducing it.

### 2026-10-20: design audit and v0.1.43
- Released v0.1.43 from `8b22c66`, a prerelease built from `work/windows-release`. The publish run, [39420567994](https://github.com/ShadowEsu/Unvibe/actions/runs/39420567994), passed and all four installers return 206. electron-builder tagged `main` (`bb2f93c`), so I moved the tag to `8b22c66`. Check `git rev-list -n1 vX` after every publish from a non-main branch.
- Gates: build run [39417063196](https://github.com/ShadowEsu/Unvibe/actions/runs/39417063196) passed, and device run [39419576081](https://github.com/ShadowEsu/Unvibe/actions/runs/39419576081) passed on both OSes with a strict axe gate. I opened the screenshots. The axe gate found two real issues earlier, and both are fixed; keep it strict.
- Site: the homepage now opens on a real 0.1.43 recording that is visible in the 1440x900 first viewport. Real screenshots, no allowance number, download v0.1.43. Details are in HANDOFF §13.
- Lesson: `site-shots.mjs` across every route can run past the 20-minute verify slot. Run only the changed routes, and set a time limit (`timeout`) on the command.
