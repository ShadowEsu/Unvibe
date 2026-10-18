# Unvibe handoff (16 Oct 2026)

Everything a new person or agent needs to pick up Unvibe where it stands today.
**Agents: read [`docs/SENDOFF.md`](SENDOFF.md) first.** It holds the full idea, history, lessons, every open task, and the protocol for keeping these notes current.

## 1. What Unvibe is

A desktop app for Mac and Windows that explains the code AI writes for you. Select code, press
the shortcut, and Vibe explains it beside your editor at one of five depths (New, Beginner,
Intermediate, Advanced, Expert). It quizzes you ("Prove it" asks what breaks if a line changes),
saves lessons to a Library, and its Briefs review the git diff after an AI agent edits many files.
Free to use. Pro is $9/month or $81/year. Teams is $8 per seat.

Founder: Preston Susanto, preston@unvibe.site. Public founder page: https://unvibe.site/about

## 2. Where things live

| Thing | Where |
| --- | --- |
| Repo | github.com/ShadowEsu/Unvibe (public). Work branch: `claude/website-app-review-82c93b-q2ajlz`, then fast forward `main`. |
| Desktop app | `app/` (Electron + React). Build: `npm run build`, check: `npm run typecheck && npm test`. |
| Website | `marketing/` (Next.js) at https://unvibe.site. Vercel project `unvibe-site` auto deploys from `main`. |
| API + AI | `web/` (Next.js) at https://api.unvibe.site. Vercel project `unvibe-api` (prj_h0TU7Td2Cpq39z2lF0uuDwFUZUp7, team team_Q6QNWAdrTSwC1sWLzSzPxzyi). **Does not auto deploy**: deploy manually from `web/` using the Vercel CLI. The project currently has root directory `.`, framework Next.js. |
| Database + auth | Supabase project `aupxkhoczqnubiznqazp` (users, device_codes, waitlist, referrals, gifts, billing tables, site_feedback). |
| Editor bridge | `extension/` packages `unvibe-desktop-bridge-0.1.2.vsix`, bundled into the app. It is what makes ⌘U work inside VS Code and Cursor. |
| AI model | Gemini (`gemini-3.1-flash-lite`) via GEMINI_API_KEY on the API. Streams token by token. |
| Payments | Stripe, **still in test mode**. Code in `web/src/billing`. |
| Email | Resend for the automatic welcome email. Preston's Gmail for manual sends. |
| Docs in Drive | Folder "Unvibe screenshots and capabilities (v0.1.37, Oct 2026)": a screenshot gallery doc and a capabilities doc. Screenshots also at https://unvibe.site/press/app/ and /press/site/. |
| Agent kit | https://unvibe.site/kit and /kit.md: the facts agents may use when writing about Unvibe. |
| Private stats | https://unvibe.site/s/OElD_dFiicMZfQaa (only Preston knows it). |

## 3. Rules that always apply

- Commits are authored as Preston only: `git -c user.name="Preston Susanto" -c user.email="prestonjaysusanto@gmail.com" commit ...`. No co-author or session trailers. Never show Claude as a collaborator on GitHub.
- No pull requests or GitHub comments unless Preston asks.
- Every app version change gets an entry in `marketing/src/data/milestones.ts` (the public changelog at /releases).
- Never present mock output as real. Never disable TLS checks. Never paste secrets (Supabase keys, REWARD_LINK_SECRET, the signing certificate) into chat or commits.
- Say "in Claude for Startups", never "Anthropic partner" or "backed by Anthropic", and use no Anthropic logo.
- Writing style for Preston: short, plain, no dashes in the middle of sentences.

## 4. How to ship a release

1. Bump `app/package.json` version, run `npm install --package-lock-only` in `app/`.
2. Add the milestones entry. Commit, push the branch, fast forward `main`, push.
3. Run the GitHub workflow **Desktop app release** (`app-release.yml`) on `main` with `publish: true`.
   It builds the editor bridge, Mac DMGs (arm64 and x64, ad-hoc signed unless the signing secrets below exist), Windows setup and portable exe, and publishes `SHA256SUMS-mac.txt` and `SHA256SUMS-windows.txt`.
4. When all four installers answer a ranged GET with 206, update the site version strings in
   `marketing/src/app/api/beta-download/route.ts`, `marketing/src/lib/betaInstallScript.ts`,
   `marketing/src/lib/betaOffer.ts`, `marketing/src/lib/betaInstallStats.test.ts` (it uses an escaped `0\.1\.NN` form too), run `cd marketing && npm test`, commit "Site downloads point at vX", push `main`.
5. Installed apps check for updates every hour and show a desktop notification; clicking it installs.
6. If `web/` changed, deploy the API manually (see the table).

The Mac DMG step has failed twice with "hdiutil detach" errors; the workflow now turns Spotlight off on the runner and retries packaging once.

## 5. Current state

- **Storage (18 Oct): Supabase, not Blob.** The Blob store `unvibe-waitlist` is suspended (limits exceeded), so writes there had been failing. Lifting the suspension is Preston's billing call.
  - Tables (RLS on, no policies, service role only; migration `20261018160000`):
    - `email_suppression`: sha256 of the email;
    - `trial_installs`;
    - `trial_counters` + RPC `trial_reserve`: atomic, returns −1 at the limit. The older `trial_usage` table (monthly periods) is unused and left alone;
    - `trial_activation`: write-once markers, sample and own code.
  - Both Supabase clients fetch with `cache: 'no-store'`, because the Next.js fetch cache had served stale counts (`5003517`).
- **Verified on 18 Oct:**
  - `trial_reserve` returned 1, 2, −1 at limit 2.
  - Across 3 device runs and 4 API redeploys, rows persisted. Each run's install shows used 3 and the global counter 6.
  - `admin/stats` shows real rows. Its token is in `~/.config/preston-secrets/unvibe-admin-stats.env`, configured server-only on `unvibe-api` and `unvibe-site`.
  - **CI is excluded (`3704608`).** `trial_installs.qa` flags CI installs: the device test POSTs its install ID to `/api/v1/admin/qa-install`, using the GitHub secret `UNVIBE_ADMIN_STATS_TOKEN`. The 6 earlier CI installs were flagged by their run times. `admin/stats` counts real users only and reports `qaExcluded`. Run 39166809642 flagged both of its installs (HTTP 200). On 18 Oct there were **0 real installs** and 8 QA installs excluded.
- **18 Oct resumed work:** founder metrics now consume Supabase and expose the 14-day UTC activation table. Only completed, non-empty selection explanations create markers; failures and follow-ups do not. This covers anonymous trials, not signed-in users, and does not prove shortcut use. No desktop analytics or new PII.
- **Growth snapshot, 18 Oct 21:31 UTC:** 634 GitHub installer downloads (316 Mac, 318 Windows; excludes updater ZIPs), 14 email signups. Downloads include repeats, updates and CI, not unique people. Mixpanel reports 39 tracked browser identities with either conversion (14 signup-only, 24 download-only, 1 both), not a dedupe of GitHub downloads against emails.
- **Daily UTC counts, 5–18 Oct:** real trial installs / first sample / first own-code explanations are 0 on every day; 8 QA installs excluded. Email signups: 1 on 7 Oct, 1 on 8 Oct, 0 on every other day. GitHub supplies cumulative asset counts, not historical download days; do not invent daily downloads or add them to email signups.
- **Site improvement:** the hero promise and CTA no longer start at opacity 0. With JavaScript disabled, the live baseline hid the whole hero; the local build shows the heading and download without hydration. Only the mascot bubble retains its entrance. At 320 px, the email input and button now fit between x=21.25 and x=298.75; the old 94vw inner width extended beyond the viewport despite `overflow-x: clip`.
- **Checks:** web 64 tests and marketing 66 tests pass, both typecheck/build pass. Founder metrics HTTP smoke returns Supabase, 14 daily rows and 8 QA excluded. Device [39168582170](https://github.com/ShadowEsu/Unvibe/actions/runs/39168582170) passes both OSes on released v0.1.42: first explanation Mac 17.1 s, Windows 11.1 s. Panel screenshots checked on both OSes. Windows whole-screen captures remain on the earlier sample while its panel capture shows the current Notepad explanation; compositor evidence is limited, not proof of a product regression.
- **Deployed and verified:** site source `1e6ea6d`, production `unvibe-site-i7a0b4u4y-shadowesus-projects.vercel.app` (aliases unvibe.site/unvibe.live); API `unvibe-hftutmd4f-shadowesus-projects.vercel.app`, health 200. The live authenticated founder endpoint returns Supabase, all 14 daily real activation rows at 0, and 12 CI installs excluded. Live 1440/390/320 screenshots checked; 320 form bounds x=21.25–298.75, no document overflow, reduced-motion bubble animation disabled, heading and desktop CTA visible with JavaScript disabled.
- **Post-deploy device proof:** [39168828120](https://github.com/ShadowEsu/Unvibe/actions/runs/39168828120) PASS both OSes; first sample Mac 16.4 s, Windows 23.0 s. Panel screenshots opened. The two new QA installs each persisted sample and own-code markers (2 of each total) after real provider generation; all are excluded from real activation. No new desktop release, email send, signup-delivery change, billing or data reset.
- **Next:** watch for the first non-CI completed trial explanation using the existing daily dashboard; report downloads/signups separately. Historical per-day GitHub downloads and an exact cross-system people total are unavailable from current anonymous data. Keep those limits explicit rather than adding identifiers.
- **Failed unsubscribes:** 0 found in unvibe-site logs for the last 24 h, across 12 deployments. Older logs are not retained.

- **Latest release: v0.1.42** (18 Oct), published from `f90d09e` by [release run 39102708728](https://github.com/ShadowEsu/Unvibe/actions/runs/39102708728); all four installers 206; Mac signed with the stable identity. It is the new three-step first run. Before publishing, the same app code (`a3f80b3`, `app/` identical) was built without publishing ([39102087100](https://github.com/ShadowEsu/Unvibe/actions/runs/39102087100)) and passed the device test on that build ([39102449853](https://github.com/ShadowEsu/Unvibe/actions/runs/39102449853)). Launch to first explanation took **17.8 s on Mac and 11.0 s on Windows** (GitHub runners, one run each). v0.1.41 (`bef3c1f`) shipped the Windows "this PC" wording; v0.1.40 was the first stable-signed Mac build.
- **First run (v0.1.42):**
  1. Hello, with the name optional and Google sign-in optional.
  2. Explain a built-in sample for real. It goes through `onboarding:explainSample` to `startReview({ sample: true })`, and the sample lives in `main.ts` `FIRST_RUN_SAMPLE`. No permission is needed.
  3. The real shortcut, plus one "Allow Accessibility" button with its reason.
  There is no sign-in wall on later launches; sign-in lives in the account menu.
- **Proving a change before release:** `gh workflow run app-release.yml -f publish=false`, then `gh workflow run real-device-test.yml -f version=0.1.NN -f build_run=<that run id>`. Publish only after both OSes pass and the screenshots are checked.
- **Site downloads:** point at v0.1.42 on `main`. The site teaches Control+U (Mac) and Ctrl+Alt+U (Windows) and gives phones "Email me the link".
- **API:** the Prove it prompt was deployed to `unvibe-api` on 16 Oct. `https://api.unvibe.site/api/v1/health` returned HTTP 200 afterward.
- **Real device test on v0.1.41:** [run 39076481851](https://github.com/ShadowEsu/Unvibe/actions/runs/39076481851) PASSED every step on macOS and Windows (same walkthrough as v0.1.40's [run 39008453354](https://github.com/ShadowEsu/Unvibe/actions/runs/39008453354)): onboarding, Google sign-in up to Google's page, Home and seven pages, the registered shortcut (Mac Control+U, Windows Control+Alt+U), the editor URI path and the global shortcut in TextEdit/Notepad with completed non-mock explanations. Windows screenshots show "Saved on this PC". Limits: GitHub runners; no completed Google login; Accessibility persistence across a stable-signed upgrade and native portable self-update are unverified.
- The 13 Oct counts (3 app users, 14 waitlist entries, 0 paid subscriptions) are historical, not a fresh production audit. Daily health routine management is out of scope at Preston's request.

## 6. Why ⌘U "doesn't work" (root causes found 13 Oct)

1. **The editor bridge previously never shipped.** `app/package.json` bundles `extension/release/unvibe-desktop-bridge-0.1.2.vsix`; v0.1.39 CI builds and includes it. Installing and exercising the actual editor extension remains distinct from testing the `unvibe://review` handler.
2. **Outside editors the shortcut is Control+U on Mac**, which needs Accessibility. The app clears a stale Accessibility entry after an update (`repairAccessibilityAfterUpdate` in `main.ts`).
3. **Stable Mac signing is configured and shipping from v0.1.40.** `MAC_SELF_SIGN_P12` and `MAC_SELF_SIGN_PASSWORD` were added to GitHub on 16 Oct. Fingerprint `C9DA4F618ADF98911A450E041B8F336574A99D0E`. Private backups are in `~/.unvibe-signing/` with restricted permissions; never print or commit them. Reuse this certificate rather than regenerating it. Users updating from ad-hoc builds (≤ v0.1.39) are asked for Accessibility once more; that later updates keep the permission is expected but has not been verified on a real upgrade.
4. Without Apple notarization ($99/year Developer ID) a browser download always shows the macOS "Open Anyway" step once, which asks for the Mac password. The Terminal install line avoids it.

## 7. Windows release status

Testers Tejas, Dan, Oussamah, Mithun and others reported selection and shortcut problems. The following changes shipped in **v0.1.39**; native behavior must be evaluated with the corrected real-device test, not the original false-positive report:
- Ctrl+U is no longer grabbed globally on Windows; the Windows default is Ctrl+Alt+U, with a one-time migration (`settings.ts`, `registerShortcut` in `main.ts`).
- Clear message when copying a selection fails; warning when the shortcut cannot be registered.
- Selection copy sends Ctrl+Insert instead of Ctrl+C (Ctrl+C interrupts terminals) and skips the retry in terminals; one PowerShell call finds the foreground app and copies (`selection.ts`).
- Windows wording in the companion: shortcut hints, onboarding key, voice tip (Win+H), "this PC" (`companion.tsx`).
- Updater: portable exe updates itself instead of installing a second copy, silent setup (`/S --force-run`), spawn errors handled (`updater.ts`, `core/update.ts`, test added).
- `windowsHide: true` on git and helper processes (no flashing consoles), colour tray icon on Windows, launch at login on Windows, greeting name from the OS user, `renderer/shared/platform.ts` helper for Windows wording.
- Companion window gets real min/max/close buttons via `titleBarOverlay` (`windows.ts`).

Also shipped in v0.1.39:
- `v7.css` reserves 150px at the right of the Windows topbar for caption buttons.
- `bar.tsx` only attaches the top-center Island to the notch on Mac, matching `windows.ts`.
- Widget keyboard shortcuts accept `ctrlKey` as well as `metaKey`.
- Review panel, Ask Vibe voice tips, account menu and usage meters use platform-specific wording.
- Portable updates now swap the new exe into the original path so existing shortcuts do not keep launching the old version. A real-filesystem smoke check verified replacement at the original path, rollback after a denied replacement, and removal of partial downloads with simulated Windows/network/process boundaries. Native locked-exe update/relaunch behavior remains unverified.

## 8. Real device test (Mac and Windows)

Workflow `real-device-test.yml` (run it from GitHub Actions, optional input `version`). It installs the released app on GitHub's macOS and Windows machines and uses Playwright to walk onboarding, start Google sign-in up to Google's own page, open every page, test the editor shortcut path (`unvibe://review`) and the global shortcut in TextEdit/Notepad, and screenshots every step. Results are in the run's artifacts and the "Walk through the app" log.

The [original v0.1.39 run](https://github.com/ShadowEsu/Unvibe/actions/runs/38980828564) did not prove the complete flow:
- Both operating systems timed out during onboarding. The test matched `Continue with Google` as `Continue`, then reported Home/sidebar passes without checking navigation.
- Windows reported that neither the editor URI nor the Notepad shortcut opened the panel. It guessed Ctrl+U after failing to read a UI label, instead of checking the registered Ctrl+Alt+U accelerator.
- Mac reported both review paths as PASS, but its check accepted the selected-code preview as an explanation before generation completed. Google-page navigation also failed on Mac in that run.
- Artifacts were successfully downloaded with `gh run download 38980828564 -R ShadowEsu/Unvibe -D /tmp/unvibe-v0139-device-evidence`; the old cloud-proxy restriction does not apply to this Mac.
- The corrected walkthrough uses exact onboarding labels, verifies each page title, checks the registered accelerator, requires the expected selected code plus a completed non-mock explanation, isolates protocol launches to the same QA profile, uses CSP-compatible locators (no `waitForFunction`, the app's `script-src 'self'` stays intact), brings Notepad to the foreground and confirms it before sending keys, and exits nonzero on any failure. With it, v0.1.39 passed fully on Mac and failed only the Notepad step on Windows. That failure was a test focus problem: Edge's welcome page was in front, as the screenshot shows. After the focus fix, v0.1.39 and v0.1.40 both pass on both platforms.

## 9. What users asked for (research, 13 Oct)

Top asks from email replies, site feedback and analytics:
1. **A first run that always works**, with visible status and errors, the correct shortcut per OS, and a guided "select this and press the shortcut" step. Funnel today: 425 install script fetches, 15 installs, 1 learning event.
2. **Installs you can check** (done in v0.1.38: checksums, readable scripts, verify section on /install-help).
3. **"Prove it" quizzes** that test consequences, cite lines and say "unknown" instead of guessing (shipped in v0.1.39; API prompt deployed).
4. A living project map: architecture and the "why" from commits and PRs, kept fresh.
5. Agent and PR Briefs for team leads ("does the author understand this PR").
6. Linux build (5 asks; out of scope in CLAUDE.md, needs Preston's sign-off).
Also: several contacts distrusted outreach emails that read as AI-written; personal replies from Preston matter.

## 10. Open items for Preston

- Switch Stripe to live only after account authorization and billing approval: create live Pro prices and a live webhook to `https://api.unvibe.site/api/v1/billing/webhook`, then set the live key, webhook secret and price IDs in `unvibe-api` and redeploy. Teams requires `STRIPE_PRICE_TEAMS_MONTHLY` and `STRIPE_PRICE_TEAMS_ANNUAL`. Current source prices are Pro $9/month or $81/year; Teams $8/seat/month or $72/seat/year. Stripe Composio connections were EXPIRED at the latest check; no live billing mutation has been performed.
- X is explicitly deferred by Preston. Keep the unverified link hidden; do not create or switch accounts.
- Supabase cleanup is complete with Preston's authorization: deleted only the two test `site_feedback` rows (`short`, `deploy check please delete`), preserving the real feedback. The CauliformAI paused project was subsequently deleted; Unvibe and jaymini-prod were preserved. No further destructive cleanup is authorized by this handoff.
- Preston owns email follow-ups. Do not inspect or prepare the inbox or send messages.
- Optional Apple Developer ID/notarization requires a separate purchase/owner decision. No purchase or credit redemption is authorized.

## 11. Plan: verify the three unproven paths (written 17 Oct, planning only, nothing run yet)

Nothing below needs a new release: v0.1.41 is the newest release, so v0.1.40 → v0.1.41 is the upgrade under test. Every step that touches a machine, CI or production data needs BOSS/Preston's go first; the gate is named on each step.

### 11.1 Accessibility survives a stable-signed update (Mac)
Evidence already gathered (read-only, 17 Oct): `codesign -d -r-` on the released arm64 zips gives
- v0.1.39: `designated => cdhash H"ad7c58ba…"` (ad-hoc, so it changed every build; this is why permission dropped),
- v0.1.40 and v0.1.41: the same `designated => identifier "com.unvibe.app" and certificate leaf = H"c9da4f61…a99d0e"`, `Authority=Unvibe Self Signed`. `codesign --verify --deep --strict` passes on both.

macOS stores that requirement with the Accessibility grant, and the two requirements are identical, so the grant should carry over [INFERENCE]. The updater's ad-hoc re-sign fallback (`updater.ts`, `codesign --verify … || codesign --force --deep --sign -`) only runs if verify fails, and verify passes on the released bundles. CI can't prove persistence: `real-device-test.yml` writes TCC rows by bundle id with no `csreq`, so they match any signature. It needs a real Mac with a grant made by a person:
1. Gate: Preston's OK and a Mac he chooses (his own, or a spare user account on it).
2. Quit Unvibe. Install v0.1.40 from `Unvibe-0.1.40-mac-arm64.dmg` into /Applications. Note `codesign -dvv /Applications/Unvibe.app` shows `Unvibe Self Signed`.
3. Open it, switch it on in System Settings → Privacy & Security → Accessibility by hand, then select text in TextEdit and press Control+U. It must explain. Screenshot it.
4. Update from inside the app (the Home update card or the notification; it calls `update:install`). Wait for the relaunch, then confirm About shows 0.1.41.
5. Pass if all of these hold: there is **no** "Unvibe updated. Switch Unvibe on in Accessibility once more…" notification (`repairAccessibilityAfterUpdate` only fires when access was lost); the Accessibility switch is still on; Control+U in TextEdit explains on the first try; `cat ~/Library/Application\ Support/Unvibe/last-run-version.txt` prints `0.1.41` (the userData folder name is [UNVERIFIED]; find it with `ls ~/Library/Application\ Support | grep -i unvibe`). Screenshot each one.
6. If it fails: run `codesign -d -r- /Applications/Unvibe.app` after the update and compare it with step 2. If the requirement changed, the update path re-signed the app (look at the fallback line). If it didn't change, collect `log show --last 10m --predicate 'subsystem == "com.apple.TCC"'` and stop. Don't regenerate the certificate.
7. On pass: shorten the post-update repair note (SENDOFF §9) and record the result in §5 here.

### 11.2 Windows portable self-update replaces the pinned .exe
How the code works (`updater.ts`): `PORTABLE_EXECUTABLE_FILE` marks a portable run. The update downloads to `<exe>.download`, renames the running exe to `<exe>.old`, moves the download onto `<exe>`, starts it, and the new process deletes `.old` (`cleanupPortableUpdate`). The release picked is the newest non-draft release with a `win-x64-portable.exe` asset.
Plan: add a separate job, `portable-update`, to `real-device-test.yml` that runs on `windows-latest` only. The setup-based walkthrough stays as it is.
1. Gate: BOSS OK to edit the workflow and run it. Running it is a QA run, not a release.
2. Inputs: `from` (default the release before the newest, e.g. 0.1.40) and `to` (default newest, 0.1.41). Skip with a clear message if `to` isn't the newest release, because the updater always picks the newest.
3. Download `Unvibe-<from>-win-x64-portable.exe` to `$RUNNER_TEMP\pin\Unvibe.exe`. Keep its SHA-256 and `VersionInfo.ProductVersion`.
4. Launch it with `--remote-debugging-port=9333` and a throwaway `UNVIBE_USER_DATA`. Then `chromium.connectOverCDP`, find the companion page, and wait for onboarding to render. Playwright `_electron.launch` won't attach through the portable launcher [INFERENCE; confirm on the first run].
5. From the companion page, call `window.unvibe.updateCheck()`. Expect `available: true, latest: <to>`. Then call `window.unvibe.updateInstall()`. Use locators or evaluate with a function argument only, because CSP blocks string evaluation.
6. Poll for up to 5 min until all of these hold: `Unvibe.exe` ProductVersion = `<to>`, its SHA-256 matches `SHA256SUMS-windows.txt` for `<to>`, `Unvibe.exe.download` is gone, `Unvibe.exe.old` is gone (deleted by the new process), and an `Unvibe.exe` process is running from the pinned path (`Get-CimInstance Win32_Process` ExecutablePath).
7. Reconnect over CDP if the port is reused, or else check the process. Screenshot the About page showing `<to>`. Upload the screenshots with the existing artifact step.
8. Failure classes to report separately: download failed (network or redirect), rename blocked (file lock or AV), new exe never started, `.old` left behind.
Also worth testing after this works: the setup (NSIS) path, `/S --force-run`, from the installed setup build.

### 11.3 Completed Google sign-in
The flow (`web/app/api/v1/auth/{device,approve,token}`, `marketing/src/app/activate/page.tsx`): the app gets a device and user code, then opens `unvibe.site/activate`. The browser signs in to Supabase (Google OAuth with PKCE, or a magic link), then POSTs `/approve` with the user code and the Supabase bearer token. The app polls `/token` (202 pending, then the account).
Automating Google's own login page in CI isn't viable: Google blocks automated browsers and asks for 2FA or captcha [INFERENCE from common behaviour; not tried]. So split it:
1. **Everything except Google's page, automated.** Gate: Preston OKs (a) a dedicated test user in Supabase `aupxkhoczqnubiznqazp` (e.g. `qa+device@unvibe.site`) and (b) storing a service-role key as a GitHub secret. In the walkthrough, after "Google sign-in starts in the app: code X":
   - mint a session with `auth.admin.generateLink({ type: 'magiclink' })` + `verifyOtp({ token_hash })`;
   - POST `/api/v1/auth/approve` with `userCode=X` and the bearer token;
   - assert the app shows the signed-in account (name or email in the account menu) and that `usage:get` reflects that user.
   - Then delete the user's device-code row. Keep the test user and record its id here.
2. **Google's page itself, by hand, once per auth change.** Gate: Preston. On a real Mac and on Windows: Sign in → Continue with Google → pick an account → "Connect this device" → the app shows the account within 10 s. Screenshot every step. The Windows 11 report "Google sign-in did not open the default browser" is part of this check.
3. Pass is (1) green in CI plus (2) screenshots from both OSes.

### Order
11.2 first: it needs only workflow edits and an OK, no people or production data. Then 11.1, which needs Preston and a Mac for about 10 minutes. Then 11.3, which needs two approvals.
