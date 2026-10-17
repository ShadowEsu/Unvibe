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

- **Latest release: v0.1.40** (17 Oct), published from `6291975` by [release run 39008035025](https://github.com/ShadowEsu/Unvibe/actions/runs/39008035025). All four installers returned HTTP 206 to ranged GETs; both checksum manifests are release assets. It is the first Mac build signed with the stable `Unvibe Self Signed` identity (log: "1 valid identities found", both architectures signed with `C9DA4F61…A99D0E`). It also fixes the Today page, where Up next ran into Recently understood at ~1024px wide.
- **Site downloads:** point at v0.1.40 on `main` (`59831b0`); live `https://unvibe.site/install.sh` and `install.ps1` serve v0.1.40.
- **API:** the Prove it prompt was deployed to `unvibe-api` on 16 Oct. `https://api.unvibe.site/api/v1/health` returned HTTP 200 afterward.
- **Real device test on v0.1.40:** [run 39008453354](https://github.com/ShadowEsu/Unvibe/actions/runs/39008453354) PASSED every step on both macOS and Windows: onboarding (all 5 steps), Google sign-in up to Google's own page, Home and all seven pages, the registered shortcut (Mac Control+U, Windows Control+Alt+U), the editor URI path and the global shortcut in TextEdit/Notepad, each with a completed non-mock explanation of the expected code. Limits: GitHub runners, not testers' machines; Google sign-in is checked only up to Google's page, not a completed login; Accessibility persistence across a stable-signed upgrade and native portable self-update are still unverified.
- **On `main` but not released:** `b88ee5a` replaces the remaining "this Mac" copy on Windows (sidebar sync label, two settings rows, About). It ships with the next release.
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
