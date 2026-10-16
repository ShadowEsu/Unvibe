# Unvibe handoff (16 Oct 2026)

Everything a new person or agent needs to pick up Unvibe where it stands today.

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
| API + AI | `web/` (Next.js) at https://api.unvibe.site. Vercel project `unvibe-api` (prj_h0TU7Td2Cpq39z2lF0uuDwFUZUp7, team team_Q6QNWAdrTSwC1sWLzSzPxzyi). **Does not auto deploy**: deploy manually from `main` with root directory `web`, framework nextjs. |
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

- **Latest release: v0.1.38** (13 Oct). Includes the founder page, checksum verified installs (install.sh and install.ps1 refuse a download that does not match), FAQ answers for "app or extension" and "which shortcut".
- **Committed on `main` but not released yet:** editor bridge built in CI, optional stable Mac signing, Accessibility repair after updates, the Real device test workflow.
- **Committed on the work branch only (not on `main`):** "Prove it" quiz as the default mode (app `learn.tsx` and `web/src/ai/prompt.ts`), and the unfinished Windows fixes (section 7). The `web/` prompt change also needs an API deploy.
- Health: no runtime errors on site or API in the last checks. Google sign-in has succeeded every time since the 7 Oct fix. 3 app users, 14 waitlist entries, 0 paid subscriptions.
- **Daily health check routine** "Unvibe daily health check" runs at 7:52am Pacific and emails the result. It has no Supabase or Vercel connectors, so the data checks are skipped; recreate it from the claude.ai routines page to attach them.

## 6. Why ⌘U "doesn't work" (root causes found 13 Oct)

1. **The editor bridge never shipped.** `app/package.json` bundles `extension/release/unvibe-desktop-bridge-0.1.2.vsix`, but CI never built it, so the app could not install the bridge and ⌘U inside VS Code/Cursor did nothing. Fixed on `main` (CI step "Build editor bridge"); ships in the next release.
2. **Outside editors the shortcut is Control+U on Mac**, which needs Accessibility. Each update is ad-hoc signed with a new signature, so macOS silently stops honouring the Accessibility switch after every update ("Re-check" stays Not granted). The app now clears the stale entry and asks again after an update (`repairAccessibilityAfterUpdate` in `main.ts`).
3. **The real fix for 2, and for the keychain asking for the password after updates, is a stable signature.** The workflow supports a self-signed identity through two repository secrets, `MAC_SELF_SIGN_P12` and `MAC_SELF_SIGN_PASSWORD`. The certificate was generated and the values are in a private file in the 13 Oct session scratchpad (`signing/github-secrets-to-add.txt`). **Preston needs to add them at https://github.com/ShadowEsu/Unvibe/settings/secrets/actions.** If that file is gone, generate a new one: a self-signed cert with the Code Signing extended key usage, CN "Unvibe Self Signed", exported as a 3DES/SHA1 PKCS#12 so macOS `security import` accepts it.
4. Without Apple notarization ($99/year Developer ID) a browser download always shows the macOS "Open Anyway" step once, which asks for the Mac password. The Terminal install line avoids it.

## 7. Windows: what is broken and what is half done

An audit (13 Oct) found these. Testers Tejas, Dan, Oussamah, Mithun and others reported the symptoms.

Done but **uncommitted to `main`, untested on Windows** (work branch only):
- Ctrl+U is no longer grabbed globally on Windows; the Windows default is Ctrl+Alt+U, with a one-time migration (`settings.ts`, `registerShortcut` in `main.ts`).
- Clear message when copying a selection fails; warning when the shortcut cannot be registered.
- Selection copy sends Ctrl+Insert instead of Ctrl+C (Ctrl+C interrupts terminals) and skips the retry in terminals; one PowerShell call finds the foreground app and copies (`selection.ts`).
- Windows wording in the companion: shortcut hints, onboarding key, voice tip (Win+H), "this PC" (`companion.tsx`).
- Updater: portable exe updates itself instead of installing a second copy, silent setup (`/S --force-run`), spawn errors handled (`updater.ts`, `core/update.ts`, test added).
- `windowsHide: true` on git and helper processes (no flashing consoles), colour tray icon on Windows, launch at login on Windows, greeting name from the OS user, `renderer/shared/platform.ts` helper for Windows wording.
- Companion window gets real min/max/close buttons via `titleBarOverlay` (`windows.ts`).

Still to do before releasing the Windows work:
- Reserve space for the overlay buttons: in `v7.css` add `:root[data-platform="win"] .topbar { padding-right: 150px; }` (the `data-platform` attribute is already set in `companion.tsx`). Without it the buttons cover Search and Explain.
- `bar.tsx` still treats `top-center` as notch-attached on every OS (`setAttached(barPosition === 'top-center')`). Make it Mac-only to match `windows.ts`, or the Windows top pill is squashed.
- Widget keyboard shortcuts accept only `metaKey` (`widget.tsx`); accept `ctrlKey` too.
- Remaining Mac-only wording in the review panel and Ask Vibe voice tips (`widget.tsx`, `chat.tsx`, use `voiceHowTo` from `renderer/shared/platform.ts`) and in `accountMenu.tsx` / `usageRings.tsx` (⌘ hints).
- Then run the **Real device test** workflow (section 8) on the new release and look at the Windows screenshots.

## 8. Real device test (Mac and Windows)

Workflow `real-device-test.yml` (run it from GitHub Actions, optional input `version`). It installs the released app on GitHub's macOS and Windows machines and uses Playwright to walk onboarding, start Google sign-in up to Google's own page, open every page, test the editor shortcut path (`unvibe://review`) and the global shortcut in TextEdit/Notepad, and screenshots every step. Results are in the run's artifacts and the "Walk through the app" log.

First run on v0.1.38 (13 Oct):
- Mac: app opens, onboarding, Google sign-in start and Google page, every page, editor path explanation, global shortcut in TextEdit explanation: all PASS. "All five onboarding steps" FAIL (a Continue button click timed out; likely the test's selector on the Connect step, check the screenshots).
- Windows: same passes, but the editor path FAILED (the review panel did not open from `unvibe://review`) and the global shortcut copied the wrong window (the panel showed Unvibe's own onboarding text instead of Notepad's). This matches what Windows testers reported.
- Artifacts are stored on Azure blob storage that the cloud session's proxy blocks; to view them, either download from the run page, or add a step that uploads the screenshots somewhere reachable (for example a GitHub release asset).

## 9. What users asked for (research, 13 Oct)

Top asks from email replies, site feedback and analytics:
1. **A first run that always works**, with visible status and errors, the correct shortcut per OS, and a guided "select this and press the shortcut" step. Funnel today: 425 install script fetches, 15 installs, 1 learning event.
2. **Installs you can check** (done in v0.1.38: checksums, readable scripts, verify section on /install-help).
3. **"Prove it" quizzes** that test consequences, cite lines and say "unknown" instead of guessing (built, on the work branch).
4. A living project map: architecture and the "why" from commits and PRs, kept fresh.
5. Agent and PR Briefs for team leads ("does the author understand this PR").
6. Linux build (5 asks; out of scope in CLAUDE.md, needs Preston's sign-off).
Also: several contacts distrusted outreach emails that read as AI-written; personal replies from Preston matter.

## 10. Open items for Preston

- Add the two signing secrets (section 6).
- Switch Stripe to live: create live Pro prices and a live webhook to `https://api.unvibe.site/api/v1/billing/webhook`, put the live secret key, webhook secret and price IDs in the `unvibe-api` Vercel env, redeploy. Add `STRIPE_PRICE_TEAMS_MONTHLY` and `STRIPE_PRICE_TEAMS_ANNUAL` to turn on Teams checkout.
- Confirm the X/Twitter handle (x.com/unvibe_app is a 404, so the link is hidden).
- Delete the two test rows in Supabase `site_feedback` ("short", "deploy check please delete").
- Inbox follow-ups: reschedule Arie Kogan, call Amr Dabbas, Ubaid Usman's review was due 16 Oct, MakerHunt free listing offer, Manasvin asked to verify installs (point him to /install-help).
- Optional: Apple Developer ID ($99/year) to remove the first-open warning entirely.
