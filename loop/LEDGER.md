## Pass 0 Studio | run 1 | 2026-08-14T21:45:00Z
agents: orchestrator
built: skills/*, .cursor/commands/*, .cursor/rules/00-core.mdc, agents/ROSTER.md, loop/*
deleted: nothing
findings: 0/0/0
score: fidelity n/a signature n/a copy n/a motion n/a a11y n/a resp n/a perf n/a = PASS
gate: PASS
unsure: Studio lives at repo root. Site remains in marketing/ so the waitlist API and Vercel project stay put. Tailwind stays v3 with the spec tokens mapped in globals.css, because a v4 migration would stall the visual rebuild.

## Pass 1 Research and tokens | run 1 | 2026-08-14T21:50:00Z
agents: A1 A2 A3
built: skills/teardown-research/notes/raycast.com.md, linear.app.md, marketing/src/app/globals.css, marketing/tailwind.config.ts, marketing/src/content/copy.ts
deleted: purple page tokens, Instrument Serif, light waitlist band colors
findings: 0/0/1
score: fidelity 91 signature n/a copy 90 motion n/a a11y n/a resp n/a perf n/a = 91 fidelity axis
gate: PASS
unsure: Accent is amber per spec, not the purple overlay from earlier chats. Spec wins.

## Pass 2-5 Pages | run 1 | 2026-08-14T22:10:00Z
agents: B1 B2 B3 C1 C2 D1-D5
built: primitives, GlassNav, Footer, ExplainSweep, Home, Pricing, Teams, Blog, kitchen-sink
deleted: homepage screenshot gallery, 6-step journey animations, GSAP cover
findings: pending typecheck
score: pending
gate: in progress
unsure: Blog posts are real but shorter than 700 words. Changelog kept as /releases.

## Pass 6-8 Audit and subtract | run 1 | 2026-08-14T21:56:00Z
agents: orchestrator
built: btn-filled CSS, diamond mark, live routes 200
deleted: homepage gallery, 6-step journey, GSAP cover, grain, orb, lavender waitlist (from the live tree)
findings: 0/1/3
score: fidelity 88 signature 90 copy 88 motion 86 a11y 82 resp 84 perf 84 = 87
gate: REPAIR later
unsure: Unused old section files still sit in marketing/src/components/sections and still contain old tokens. They are not imported by live routes. Blog posts are short of 700 words. Atmosphere is Raycast blue plus amber bars, not purple, because the spec banned purple-to-blue gradients.

## Shortcut CTA | run 1 | 2026-08-14T22:41:00Z
agents: orchestrator
built: marketing/src/components/home/ShortcutCta.tsx, purple glow tokens, Control+U keycaps
deleted: nothing
findings: 0/0/0
score: n/a
gate: PASS
unsure: User asked Control U. Product shortcut is also Command U. Control and U are the lit keys. Purple bloom stands in for Raycast coral on this section only.

## Sync Live Site | 2026-08-16T13:10:00Z
agents: orchestrator
built: nothing (read-only alignment)
deleted: nothing
findings: 0/0/0
score: n/a
gate: PASS
unsure: Local main was 86 commits behind and still on the July narrative homepage. Live unvibe.site matches origin/codex/unvibe-studio-redesign at eeffff98 (2026-08-14), not origin/main. Checked out that branch. localhost:3000 title, nav, home/pricing/investors/releases headings match production. Dev server left running on :3000. Stashed local launchAtLogin tweak from app/src/main/settings.ts.

## Raycast teardown | 2026-08-16T13:15:00Z
agents: orchestrator
built: skills/teardown-research/notes/raycast.com.md
deleted: nothing
findings: 0/0/0
score: n/a
gate: n/a (research only)
unsure: Raycast dynamism lives in one interactive product object per section, not in CSS atmosphere. Unvibe already has ProductLoop and ⌘U keycaps, unused on the live homepage.

## Paper site rebuild | 2026-08-16T16:40:00Z
agents: orchestrator
built: marketing/src/app/page.tsx, paper.css, layout.tsx, paper/* (PhotoHero, DecoderBoard, ShortcutKeys, ToolsMarquee), Nav/Footer restyle, GitLab milestone, waitlist confirmation copy
deleted: homepage island-bar gallery beat, first-paint referral wall, public download buttons on /releases, duplicate pricing perk block
findings: 0/1/2
score: fidelity 86 signature 88 copy 90 motion 84 a11y 80 resp pending perf pending
gate: REPAIR, local proof next
unsure: First viewport stays waitlist + August 25 with no product tagline, per lock. Homepage still has overlay + dashboard stills after the demo. Visual screenshots pending at time of write. Founder/admin keep existing dark cards on paper. Waitlist API untouched.

## Paper site visual proof | 2026-08-16T14:30:00Z
agents: orchestrator
built: fixed nav overlay on photo, paper waitlist, collapsed referral details, investor/legal/pricing ink overrides, admin visitors +300
deleted: island-bar homepage beat, lonely kicker line
findings: 0/0/1
score: fidelity 88 signature 90 copy 90 motion 84 a11y 82 resp 84 perf n/a = 88
gate: PASS locally at localhost:3000
unsure: Chrome headless 1440 and 390 show photo + waitlist/August 25 with transparent ink nav. Playwright full page shows paper body, decoder, light keys, paper waitlist. Green pricing checks restyled to ink. Founder/admin remain dark cards on paper. Newsreader font-override warning from Next 14 is harmless. Live unvibe.site is not updated. Dev also bound 3001 because 3000 was already in use.

## Purple mark, keys, listing HTML | 2026-08-16T14:40:00Z
agents: orchestrator
built: purple LogoMark, lavender paper tint, purple ⌘U keys, brand CTAs, footer listing badges from prior Tool Index / DevRove / AI Tool Discovery / LaunchBuff HTML
deleted: nothing
findings: 0/0/0
score: n/a
gate: local
unsure: Badge images are remote SVGs those directories issued. If a host 404s, the backlink still exists. Waitlist API untouched.

## Hero on photo, story scroll, purple motion | 2026-08-16T14:50:00Z
agents: orchestrator
built: PhotoHero with giant Learn the code type, waitlist pill, mono countdown; StoryStage pin-fade; slower spaced decoder; Raycast key tray; dark tool logos; releases photo band plus money figures; pricing photo band and hover
deleted: installer still on /releases, duplicate homepage product headline, mid-page countdown
findings: 0/0/0
score: n/a
gate: local typecheck pass
unsure: Story pin needs a live scroll check. Waitlist API untouched.

## Center, story meter, typing FAQ, ticket waitlist | 2026-08-16T15:05:00Z
agents: orchestrator
built: centered hero/photo-band/sections, 50/50 StoryStage with 200vh pin and fill ticks, TypingFaq 2s, WaitlistInvite ticket, purple glow tokens, longer Reveal/hero motion
deleted: nothing
findings: 0/0/0
score: n/a
gate: local
unsure: Story fill is scrubbed to scroll, then the beat swaps when the bar completes. Waitlist API untouched.

## Join waitlist CTA | 2026-08-16T15:20:00Z
agents: orchestrator
built: JoinWaitlistLink in Newsreader italic, brighter CTA tokens, sheen and idle bloom on hero/nav/releases plus waitlist submit
deleted: small paper-hero__join pill
findings: 0/0/0
score: n/a
gate: local
unsure: Waitlist API and confirmation copy untouched.

## Raycast joins, Wispr split, ticket, credits | 2026-08-16T15:35:00Z
agents: orchestrator
built: Mac/Windows waitlist buttons, always 50/50 pinned story, waitlist ticket tilt/foil/orbs, smaller bolder Newsreader, Mongo 21 Jul $500, Google AI Startups 23 Jul $2000 Cloud
deleted: giant circular Join waitlist pill
findings: 0/0/0
score: n/a
gate: local
unsure: Windows is waitlist only. Mac still ships first. Waitlist API untouched.

## Team Enterprise prices, old title type | 2026-08-16T15:45:00Z
agents: orchestrator
built: Team $10/seat 2-20, Enterprise $50/mo 1000 questions, 25% annual both, Coming soon cards, Newsreader 400 restored larger, story copy boxed to image height
deleted: nothing
findings: 0/0/0
score: n/a
gate: local
unsure: Team and Enterprise are priced and not for sale yet. Waitlist API untouched.

## Hero title closer to joins | 2026-08-16T15:50:00Z
agents: orchestrator
built: paper-hero copy aligned to the foot so Learn the code sits nearer the Mac/Windows buttons
deleted: nothing
findings: 0/0/0
score: n/a
gate: local
unsure: Buttons and countdown stay pinned to the bottom of the photo.

## Dusk wash, bigger centered story | 2026-08-16T15:55:00Z
agents: orchestrator
built: fixed Golden Gate dusk behind the whole site, story type larger and centered on the still, pin 380vh per beat with slower scrub
deleted: flat paper page fill
findings: 0/0/0
score: n/a
gate: local
unsure: Cards stay slightly frosted so type still reads. Waitlist API untouched.

## Clean waitlist invite | 2026-08-16T16:05:00Z
agents: orchestrator
built: one-column Save a seat card, black join button, orbiting ring and floating ⌘U keys around it
deleted: ticket stub, barcode, admit one, purple submit glow
findings: 0/0/0
score: n/a
gate: local
unsure: Waitlist API and Joined the waitlist copy untouched.

## Glass and change log | 2026-08-16T15:40:00Z
agents: orchestrator
built: glass tokens and panels on testers, story, what shipped, waitlist, founder; black type; black 30% faster marquee; white join button; Newsreader inputs; Change Log labels; footer social icons; 8 story beats with autoplay video
deleted: grey muted type, purple waitlist submit, text-only footer socials, 3-beat-only story
findings: 0/0/0
score: n/a
gate: local
unsure: /releases URL kept. Waitlist API and Joined the waitlist copy untouched. Accent still on story meta, log figures, and FAQ caret.

## Build map rebuild | 2026-08-16T15:50:00Z
agents: orchestrator
built: /build on Golden Gate glass, branching live map with failures then merge then next audiences, animated edges, paper live session card
deleted: dark linear 7-dot roadmap, dark sign-in screenshot, grey build copy
findings: 0/0/0
score: n/a
gate: local
unsure: Next branches (wider testers, pro accounts, public beta) are marked Next, not claimed as live. Consults done is program and founder conversations only.

## Loop polish | 2026-08-16T16:00:00Z
agents: orchestrator
built: colored marquee logos, faster 18s track, decoder starts on arrival, TEST YOUR KNOWLEDGE one line, breathing Command U, clearer sharper glass, story without split glass, waitlist without hovering keys
deleted: white inverted logos, lavender key tray, story glass cards, waitlist floating command keys
findings: 0/0/0
score: n/a
gate: local
unsure: Waitlist API and Joined the waitlist copy untouched.

## Video autoplay audio | 2026-08-16T16:10:00Z
agents: orchestrator
built: AutoPlayVideo with unmuted autoplay, gesture unlock for sound, homepage demo and story clips, MarketingVideo follows the same path
deleted: muted-only story autoplay
findings: 0/0/0
score: n/a
gate: local
unsure: Browsers may start muted until the first click or keypress, then sound stays on.

## Slim map and live toggle | 2026-08-16T16:20:00Z
agents: orchestrator
built: map labels only no glass, heavier background blur, founder page live testing on/off, map Live testing node pulses when live
deleted: map cards, notes, legend, missing founder console on /founder
findings: 0/0/0
score: n/a
gate: local
unsure: Live stays on only while founder heartbeats from /founder. Waitlist API untouched.

## Decoder equal type | 2026-08-16T16:25:00Z
agents: orchestrator
built: one font size for all loop rows including TEST YOUR KNOWLEDGE on a single line
deleted: smaller long-row class
findings: 0/0/0
score: n/a
gate: local
unsure: Waitlist API untouched.

## Story size and Growth | 2026-08-16T16:40:00Z
agents: orchestrator
built: story shots at native size with opacity fade only, Live map renamed Growth, 650+ followers with X LinkedIn Instagram TikTok
deleted: paperShotDrift, shot scale, beat scale/blur, cover crop on story media
findings: 0/0/0
score: n/a
gate: local
unsure: X and TikTok URLs match Instagram handle unvibe_app. Waitlist API untouched.

## Straight growth line | 2026-08-16T16:55:00Z
agents: orchestrator
built: one horizontal growth line of every stage, 650+ with social logos as the last stop, line draws left to right
deleted: branching map, fan out, giant follower block, Not a straight line
findings: 0/0/0
score: n/a
gate: local
unsure: Waitlist API untouched.

## Growth keys and winding road | 2026-08-16T17:05:00Z
agents: orchestrator
built: Command U style X + LinkedIn + Instagram + TikTok = 650+ followers with colored logos, winding roadmap with no horizontal scroll
deleted: sliding straight timeline, social logos stuck on the map
findings: 0/0/0
score: n/a
gate: local
unsure: Waitlist API untouched.

## Glass keys, live switch, marquee | 2026-08-16T17:12:00Z
agents: orchestrator
built: glass Command U keys, slower breathe, founder live testing switch with no Google, glass oval marquee, VS Code ribbon and OpenAI Codex marks
deleted: pink key faces, black marquee bar, Google gate on live testing, fake VS Code and C-circle Codex logos
findings: 0/0/0
score: n/a
gate: local
unsure: /founder live switch is public. Waitlist API untouched.

## 75 percent changelog | 2026-08-16T17:20:00Z
agents: orchestrator
built: 75 percent to public, live testing and feedback done, GitLab 23700 pinned with star, GitHub ships in changelog, homepage top 5, social logos without glass, LinkedIn mark inset
deleted: 55 percent copy, glass key wrappers on X LinkedIn Instagram TikTok
findings: 0/0/0
score: n/a
gate: local
unsure: Waitlist API untouched.

## Production ship | 2026-08-16T16:22:00Z
agents: orchestrator
built: commit 1443d54 on origin/codex/unvibe-studio-redesign, production deploy dpl_CnXWpcVJqyiLxpbFLKe1yNmEyzuh
deleted: nothing
findings: 0/0/0
score: n/a
gate: live
unsure: unvibe.site and unvibe.live both alias the same READY production deployment. Waitlist API untouched.

## Footer social move | 2026-08-16T16:24:00Z
agents: orchestrator
built: SocialFollowLinks under footer tagline
deleted: social row from legal bar
findings: 0/0/0
score: n/a
gate: local
unsure: Waitlist API untouched.

## Pricing contrast and toggle | 2026-08-16T16:26:00Z
agents: orchestrator
built: paper pricing type to ink, oval monthly annual toggle
deleted: grey fg-muted copy on pricing cards
findings: 0/0/0
score: n/a
gate: local
unsure: Waitlist API untouched.

## App dusk theme | 2026-08-16T16:32:00Z
agents: orchestrator
built: Newsreader across companion widget bar, Golden Gate blur wash in dark mode, slower page motion
deleted: DM Sans dark radial leftover
findings: 0/0/0
score: n/a
gate: local
unsure: Waitlist API untouched. Production waitlist POST saved preston+livecheck-20260817@unvibe.site with referral 25e25c02.

## Learn workspace research | 2026-08-16T16:35:00Z
agents: orchestrator
built: canvases/learn-workspace-research.canvas.tsx
deleted: nothing
findings: 0/0/0
score: n/a
gate: local
unsure: Recommendation is merge Study History Quiz into one Learn workspace. Not implemented yet.

## History split research | 2026-08-16T16:40:00Z
agents: orchestrator
built: canvases/history-split-alternatives.canvas.tsx
deleted: nothing
findings: 0/0/0
score: n/a
gate: local
## Learn library then document | 2026-08-17T00:45:00Z
agents: orchestrator
built: app/src/renderer/companion/learn.tsx, companion.tsx, companion.css
deleted: Study History Quiz split panes in companion
findings: 0/0/0
score: n/a
gate: local
unsure: Study History Quiz now share one Learn page. Library is the list. Click opens a full document with Read Restudy Check. Escape and Library return to the same scroll position.

## San Fran gradient | 2026-08-17T00:52:00Z
agents: orchestrator
built: companion.css, companion.tsx, widget.css, bar.css
deleted: purple startup ribbons on login and onboarding
findings: 0/0/0
score: n/a
gate: local
unsure: San Fran is the Golden Gate photo wash. Startup and login use it. Light containers and the AI overlay use it. The island stays black.

## Phone nav glass | 2026-08-17T00:55:00Z
agents: orchestrator
built: marketing/src/app/globals.css, paper.css, Nav.tsx
deleted: full height phone menu with no box
findings: 0/0/0
score: n/a
gate: local
unsure: Phone menu is now a white glass dropdown card. Live site still needs a deploy.

## White light, Chat, island | 2026-08-17T01:05:00Z
agents: orchestrator
built: companion.css, companion.tsx, chat.tsx, bar.tsx, bar.css, windows.ts, preload.ts, main.ts, tones.ts, studyQuiz.ts
deleted: light-mode Golden Gate on settings and containers; grey shell/paper; beige settings sidebar
findings: 0/0/0
score: n/a
gate: local
unsure: History and Quiz are back in the sidebar. Chat is a new page that uses the selected model and counts against monthly AI. Bottom island grows in CSS after the native window resizes, so the pill should not jump. Sounds resume the shared AudioContext so Electron can actually play them.

## Streak heat and chat | 2026-08-17T04:15:00Z
agents: orchestrator
built: learning.ts, store.ts, main.ts, studyQuiz.ts, companion.css, companion.tsx, bar.css, learning.test.ts
deleted: heat cells that never received color (legend-only classes)
findings: 0/0/0
score: n/a
gate: local
unsure: Opening the app writes a local day_active event so the streak is 1 even with no review. Heat is 5 shades from 5/25/50/100/200 explained lines. Chat records lines and still stays out of History.

## Chat quiz integrations overlays | 2026-08-17T01:40:00Z
agents: orchestrator
built: chat.tsx, thinkingStatus.tsx, learn.tsx, integrations.ts, companion.tsx, companion.css
deleted: compact chat bubbles, underline quiz tabs, four-row integration list
findings: 0/0/0
score: n/a
gate: local
unsure: Chat still waits for a full reply (no token stream yet), so thinking verbs cover the wait. Quiz progress is cards cleared this sitting, not a known-length survey. Integrations stay detection-only and never write another app's config.

## Overlay size shortcut history | 2026-08-17T01:50:00Z
agents: orchestrator
built: windows.ts, widget.css, widget.tsx, selection.ts, settings.ts, main.ts, store.ts, learn.tsx, companion.tsx, companion.css, preload.ts
deleted: purple overlay tokens, golden-gate wash on the review panel, hidden Shortcut settings tab
findings: 0/0/0
score: n/a
gate: local
unsure: Control+U is always registered plus the saved shortcut. Cursor/VS Code still use the bridge at ⌘U. History deletes stay on this Mac via deletedIds so a later sync cannot restore them.

## Chat empty state and sidebar | 2026-08-17T01:55:00Z
agents: orchestrator
built: chat.tsx, companion.tsx, companion.css, settings.ts
deleted: chat remaining chip in the header, sidebar hover translateX
findings: 0/0/0
score: n/a
gate: local
unsure: Empty chat centers Hello again plus the composer, then the same field docks as the thread box. Usage percent at the bottom is green under 60, yellow to 85, red after that. Sidebar width persists from 168 to 340 and compactifies under 200.

## Social preview hero | 2026-08-17T01:58:00Z
agents: orchestrator
built: opengraph-image.tsx, twitter-image.tsx, unvibe-social-preview-v6.png, layout.tsx, og fonts
deleted: nothing
findings: 0/0/0
score: n/a
gate: local
unsure: LinkedIn still shows the old compact card until this deploys and LinkedIn Post Inspector recrawls. v6 is 1200x630 Golden Gate with the live hero line so the large top card can render.

## Founder live toggle and 162.56h | 2026-08-17T02:05:00Z
agents: orchestrator
built: FounderConsole.tsx, build-status route, buildStatus.ts, BuildLive.tsx, FounderClock.tsx, readResponseJson.ts
deleted: empty JSON parse on the live testing switch
findings: 0/0/0
score: n/a
gate: local
unsure: POST now always returns JSON. Stored totals below 162.56 hours lift on read, so the public timer shows 162.56 hrs without a blob rewrite.

## Chat model picker | 2026-08-17T02:10:00Z
agents: orchestrator
built: chat.tsx, companion.tsx, companion.css
deleted: AI settings outer border and filled inset card
findings: 0/0/0
score: n/a
gate: local
unsure: Chat always shows Unvibe AI (default) or the selected provider and model. The dropdown opens Settings on the AI tab for provider and API key changes.

## Gift Unvibe | 2026-08-17T02:20:00Z
agents: orchestrator
built: gift.ts, gift.test.ts, companion.tsx, companion.css, settings.ts, main.ts, preload.ts, PixelWaitlist.tsx, milestones.ts
deleted: UNVIBE SPECIAL placeholder copy on the waitlist form
findings: 0/0/0
score: n/a
gate: local
unsure: Waitlist API files were not edited. Signed in users get the existing 8 character email hash so /api/referrals can fill 0/5. Unsigned users get a local mixed code. Pro credit is still evaluated after signup, same as today.

## Gift Unvibe page | 2026-08-17T02:35:00Z
agents: orchestrator
built: gift.tsx, companion.tsx, companion.css, build.mjs, waitlist-form.png, waitlist-referral.png
deleted: sidebar GiftCard strip
findings: 0/0/0
score: n/a
gate: local
unsure: Gift Unvibe is a full companion page like Plan and Chat. Waitlist screenshots are the ones from unvibe.site. Pro credit is still evaluated after signup.

## Companion pane breathing room | 2026-08-17T02:40:00Z
agents: orchestrator
built: companion.tsx, companion.css
deleted: dashed empty states, 4-up Home rail on daily use, viewport-only stacking
findings: 0/0/0
score: n/a
gate: local
unsure: Pane uses container queries. Under 640px the sidebar becomes a drawer with a menu button. Hover-reveal feed actions stay visible on touch.

## Changelog Gift page companion | 2026-08-17T03:31:00Z
agents: orchestrator
built: milestones.ts, .cursor/rules/01-commits.mdc
deleted: nothing
findings: 0/0/0
score: n/a
gate: local
unsure: Changelog records the Gift Unvibe page and calmer companion pane. Commit messages from here skip agent as contributor.

## Gifts billing sign-in | run 1 | 2026-08-17T04:15:00Z
agents: orchestrator
built: web/src/gifts/*, web/app/api/v1/gifts/*, web/supabase/migrations/20260817120000_gift_redemptions.sql, marketing/src/app/api/gifts/*, marketing/src/app/activate/*, marketing/src/app/api/activate/approve/route.ts, PixelWaitlist claim, app gift:status, checkout gift id skip, device activate origin
deleted: unsigned random website gift codes
findings: 0/0/0
score: n/a
gate: local tests pending
unsure: Production still needs the gift_redemptions SQL on the web Supabase project, PUBLIC_ACTIVATE_ORIGIN=https://unvibe.site on api.unvibe.site, and https://unvibe.site/activate on the Supabase Auth redirect allow-list. Vercel MCP team picker is stuck in Cursor so env was not written from here.

## Gifts billing live deploy | run 1 | 2026-08-17T05:22:00Z
agents: orchestrator
built: storage fallback for gifts, PUBLIC_ACTIVATE_ORIGIN, UNVIBE_APP_BACKEND_URL, api.unvibe.site verified on unvibe-api, production deploys for unvibe-api and unvibe-site
deleted: nothing
findings: 0/0/0
score: n/a
gate: live gift progress 200 on api.unvibe.site and unvibe.site/api/gifts/progress
unsure: Google redirect URL https://unvibe.site/activate still has to be allowed in Supabase Auth if OAuth rejects it. Gift tables are optional now because claims use a private gift-ledger bucket when the SQL has not been applied.

## Activate San Fran wash | run 1 | 2026-08-17T06:52:00Z
agents: orchestrator
built: marketing/src/app/activate/activate.css
deleted: solid --paper fill on the device approval overlay
findings: 0/0/0
score: n/a
gate: local
unsure: Wash uses --page-photo and --dusk-veil only. Card sits on glass via --paper-raised. Not deployed.

## Private beta DMG | run 1 | 2026-08-17T07:11:00Z
agents: orchestrator
built: app/release/Unvibe-0.1.10-beta-arm64-unsigned.dmg (arm64, ad-hoc signed, backend https://api.unvibe.site)
deleted: nothing
findings: 0/0/0
score: n/a
gate: local package
unsure: GitHub prerelease upload needs founder approval. Apple silicon only. Gatekeeper right-click Open. Not notarized.

## Plan usage board | run 1 | 2026-08-17T07:40:00Z
agents: orchestrator
built: companion.tsx PlanUsageBoard, companion.css plan-pick and usage rows, settings left nav spacing
deleted: old Plan current-row plus three-up usage tiles
findings: 0/0/0
score: n/a
gate: app typecheck
unsure: Live Stripe checkout still depends on server billing config. Team remains coming soon. Local selected-code meter is the 100 monthly beta cap.

## Free cap 30 explanations | run 1 | 2026-08-17T08:10:00Z
agents: orchestrator
built: plans.ts FREE_AI_EXPLANATIONS=30, trial default 30, app local/trial/selected-code 30, pricing copy, SQL 20260817163000_free_plan_30_explanations.sql, billing and trial tests
deleted: Free 50 monthly explanation entitlement
findings: 0/0/0
score: n/a
gate: web tests: 30 allowed then 31st denied; trial default limit 30
unsure: Production plan_entitlements row still needs the SQL update on Supabase. UNVIBE_TRIAL_MONTHLY_LIMIT on Vercel should be 30.

## Command U install line | run 1 | 2026-08-17T10:10:00Z
agents: orchestrator
built: BetaInstall under ShortcutKeys Command U
deleted: nothing
findings: 0/0/0
score: n/a
gate: visual CSS
unsure: Live after the marketing deploy.

## Hero title lifted | run 1 | 2026-08-17T09:56:00Z
agents: orchestrator
built: paper-hero copy padding so title and kicker sit higher above the install line
deleted: tight 1.4rem gap under the kicker
findings: 0/0/0
score: n/a
gate: visual CSS
unsure: Live after the marketing deploy.

## Bare install line | run 1 | 2026-08-17T09:40:00Z
agents: orchestrator
built: no container, white lead for 30 explanations and 1 week Pro, beta v0.1.10
deleted: glass chip around the command
findings: 0/0/0
score: n/a
gate: visual CSS
unsure: Live after the marketing deploy.

## Glass install command | run 1 | 2026-08-17T09:33:00Z
agents: orchestrator
built: paper-beta frosted glass chip, copy icon, check after copy
deleted: black terminal block and Copy label
findings: 0/0/0
score: n/a
gate: visual CSS
unsure: Live after the marketing deploy.

## Copy paste install and pause widget | run 1 | 2026-08-17T09:22:00Z
agents: orchestrator
built: homepage OpenClaw-style install.sh command, copy/fetch/install counters, session paused overlay after 30 explanations
deleted: name and email beta form
findings: 0/0/0
score: n/a
gate: marketing tests 26 pass, limitOffer tests pass
unsure: Overlay ships with the next app build. Homepage needs the marketing deploy. Google sign-in is still the later task.

## Beta install form live | run 2 | 2026-08-17T09:00:00Z
agents: orchestrator
built: paper-beta compact equal fields, 2rem matching button, Show command, production unvibe.site
deleted: two-line Show the install command button
findings: 0/0/0
score: n/a
gate: live CSS minmax 1fr 1fr max-content, height 2rem, homepage and investors Show command
unsure: Hard refresh if the old two-line button is cached.

## Beta install form tighter | run 1 | 2026-08-17T08:52:00Z
agents: orchestrator
built: paper-beta form smaller equal-height fields and Show command button
deleted: two-line install button
findings: 0/0/0
score: n/a
gate: visual CSS
unsure: Live after the marketing deploy.

## Beta install and survey | run 1 | 2026-08-17T08:40:00Z
agents: orchestrator
built: PhotoHero BetaInstall command, homepage and investors survey, widget and companion limit upgrade cards, Typeform deal copy
deleted: investors copy that said there is no public download
findings: 0/0/0
score: n/a
gate: limitOffer tests
unsure: Desktop upgrade widget ships with the next app build. Site is live.

## Free cap 30 live | run 2 | 2026-08-17T08:28:00Z
agents: orchestrator
built: reviews route meters ai_explanation for signed-in and trial, trial fallback 30, supabase align on billing and boot, unvibe-api production deploy
deleted: trial reviews skipping the monthly cap
findings: 0/0/0
score: n/a
gate: billing 30 then deny; trial 30 then deny; api.unvibe.site aliased
unsure: Homepage keeps the main demo videos. A couple unused mp4s were left out of this CLI upload because of the 100MB cap.

## Beta Gatekeeper bypass | run 1 | 2026-08-17T07:50:00Z
agents: orchestrator
built: scripts/install-unvibe-beta.sh, app/build/open-unvibe.command, create-custom-dmg opener, GitHub release notes
deleted: nothing
findings: 0/0/0
score: n/a
gate: install script uploaded to v0.1.10-beta-gifts
unsure: Browser DMG downloads stay blocked until Developer ID notarization. Curl install avoids quarantine.

## Centered glass install and slim onboarding | run 1 | 2026-08-17T18:20:00Z
agents: orchestrator
built: BetaInstall glass command, investors centered stack, feedback promo link, onboarding name plus Mac settings, chat bubble width, displayName greeting
deleted: investors Join waitlist pill, onboarding depth and sample choices
findings: 0/0/0
score: n/a
gate: marketing tsc pass, app tsc pass, app tests 41/41
unsure: Survey promo is still fulfilled in Typeform. Installed DMGs need a new app build before testers see the slimmer onboarding.

## Founder clock, visits table, beta stack | run 1 | 2026-08-17T18:35:00Z
agents: orchestrator
built: BetaInstall title/version/glass command/Typeform glass, FounderConsole on/off plus hours minutes, BuildLive, founder waitlist table API, daily visits table
deleted: missing FounderConsole was the live-testing switch
findings: 0/0/0
score: n/a
gate: marketing tsc pass, marketing tests 27/27
unsure: Waitlist names on /founder are founder-only and noindexed. The clock still needs the founder page open to heartbeat while On.

## Pricing vibe coding headline | run 1 | 2026-08-17T18:40:00Z
agents: orchestrator
built: PricingHeadline.tsx, pricing page header, paper.css fade and left align
deleted: Start free pricing header copy
findings: 0/0/0
score: n/a
gate: local
unsure: Headline sits on the Golden Gate band, left aligned, Newsreader, fade in on load.

## Widget room, onboarding, curl 0.1.11 | run 1 | 2026-08-17T18:50:00Z
agents: orchestrator
built: widget two-row header plus larger panel, survey and buy-subscription pause, onboarding name/profile/Accessibility, SETTINGS_REVISION 8, install tag v0.1.11-beta-onboard
deleted: overlapping usage pill on UNVIBE
findings: 0/0/0
score: n/a
gate: app tests 41/41, marketing install tests pass, DMG on GitHub, live install.sh points at v0.1.11-beta-onboard
unsure: Trial token could not be decrypted from Vercel, so this unsigned build meters 30 explanations locally against https://api.unvibe.site. Testers already on 0.1.10 need to run the curl install again to see onboarding.

## Bigger glass install stack | run 1 | 2026-08-17T19:05:00Z
agents: orchestrator
built: paper-beta outer glass, larger curl and Typeform glass rows, 1 week Pro survey copy on hero, keys, investors, and survey section
deleted: cramped one-line beta blurb without Typeform
findings: 0/0/0
score: n/a
gate: local
unsure: Survey still unlocks 1 week of Pro, not a free month. Gift waitlist copy still says 1 month of Pro.

## Hero glass install stack | run 1 | 2026-08-17T19:05:00Z
agents: orchestrator
built: BetaInstall outer glass plus larger curl and Typeform glass rows, ShortcutKeys feedback on, BetaSurvey glass URL, 1 week of Pro copy
deleted: cramped one line beta v0.1.10 prompt
findings: 0/0/0
score: n/a
gate: local
unsure: Survey still unlocks 1 week of Pro, not a free month. Gift waitlist month is a separate offer.

## Current app stills on the site | run 1 | 2026-08-17T19:15:00Z
agents: orchestrator
built: marketing/public/product home chat learn quiz progress island gift settings shots, StoryStage and video caption
deleted: overlay-editor dashboard overview installer and old product-shots stills
findings: 0/0/0
score: n/a
gate: live unvibe.site home.png 557921 bytes, island-bar.png 200, demo mp4 200
unsure: Screenshots are 1024px wide from the chat attach pipeline. Videos stay with a note that they are a little behind.

## Compact beta glass rows | run 1 | 2026-08-17T19:21:00Z
agents: orchestrator
built: paper-beta outer card removed, glass only on curl and survey rows, 36rem max
deleted: hero-glass wrapper, 62rem padding, large type on the install block
findings: 0/0/0
score: n/a
gate: live unvibe.site CSS paper-beta 36rem transparent, glass only on term and survey
unsure: Live after marketing deploy.

## Hero foot tighter plus survey line | run 1 | 2026-08-17T21:08:00Z
agents: orchestrator
built: PhotoHero survey line to Typeform, smaller hero foot gap and copy padding
deleted: 4.6rem hero copy bottom padding, 1.1rem foot gap
findings: 0/0/0
score: n/a
gate: live unvibe.site has finish this form
unsure: Live after marketing deploy.

## Page beta as its own glass install | run 1 | 2026-08-17T21:16:00Z
agents: orchestrator
built: homepage install section below Command U, page glass only on curl and survey, beta blurb
deleted: BetaInstall nested under ShortcutKeys, solid snow link boxes
findings: 0/0/0
score: n/a
gate: live unvibe.site has install section and Apple silicon Mac blurb
unsure: Live after marketing deploy.

## Hero title up waitlist under kicker | run 1 | 2026-08-17T21:28:00Z
agents: orchestrator
built: PhotoHero title at top, waitlist between kicker and Beta App, looser title and curl gaps
deleted: waitlist and duplicate survey line from hero foot
findings: 0/0/0
score: n/a
gate: live unvibe.site order is kicker, waitlist, Beta App, curl, form, countdown
unsure: Live after marketing deploy.

## Hero waitlist space above countdown | run 1 | 2026-08-17T22:57:00Z
agents: orchestrator
built: More space around waitlist buttons, countdown sits a little lower
deleted: tight gap under waitlist
findings: 0/0/0
score: n/a
gate: live hero has air between waitlist, curl, and countdown
unsure: Live after marketing deploy.

## Founder waitlist plus copy and form counts | run 1 | 2026-08-17T22:48:00Z
agents: orchestrator
built: give it a try on homepage, professional investor beta label, form click count, full waitlist fields on founder
deleted: give a try
findings: 0/0/0
score: n/a
gate: live homepage label, investors title, founder shows copies, form clicks, waitlist emails
unsure: Survey click count starts at 0 until the next live click. Beta app already caps at 30 explanations.

## Clean mono curl like the example | run 1 | 2026-08-17T22:43:00Z
agents: orchestrator
built: Curl and Typeform use JetBrains Mono, no pixel font
deleted: Press Start 2P on install command
findings: 0/0/0
score: n/a
gate: live curl is clean mono on glass
unsure: Live after marketing deploy.

## Cleaner Command U copy | run 1 | 2026-08-17T22:24:00Z
agents: orchestrator
built: Outfit on the Command U block, short caption and install blurb
deleted: long serif install paragraph
findings: 0/0/0
score: n/a
gate: live Command U copy is short in Outfit
unsure: Live after marketing deploy.

## Tiny pixel survey back in hero | run 1 | 2026-08-17T22:20:00Z
agents: orchestrator
built: Survey back under hero curl, small copy, tiny pixel URL, no glass on the link
deleted: Survey above the demo video
findings: 0/0/0
score: n/a
gate: live hero has small pixel Typeform under curl
unsure: Live after marketing deploy.

## Pixel glass curl plus full beta label | run 1 | 2026-08-17T22:16:00Z
agents: orchestrator
built: Hero label is Beta Testing App (30 AI Explanations), give a try. Curl is glass with Press Start 2P
deleted: SF gradient curl, Give a try only
findings: 0/0/0
score: n/a
gate: live curl is glass pixel type with the full beta label
unsure: Live after marketing deploy.

## Footer GitHub star bubble | run 1 | 2026-08-17T21:58:00Z
agents: orchestrator
built: Centered Star this on GitHub bubble in the footer, linked to ShadowEsu/Unvibe
deleted: nothing
findings: 0/0/0
score: n/a
gate: live footer bubble opens github.com/ShadowEsu/Unvibe
unsure: Live after marketing deploy.

## Hero curl space plus form above demo | run 1 | 2026-08-17T21:50:00Z
agents: orchestrator
built: Feedback form above demo, Give a try label, wider SF curl wash, white Command U copy
deleted: Hero survey block, giant Beta Testing App label in hero
findings: 0/0/0
score: n/a
gate: live homepage has curl then space then countdown, form above video
unsure: Live after marketing deploy.

## Build meter smaller plus 750 followers | run 1 | 2026-08-17T21:43:00Z
agents: orchestrator
built: 75% under the /build bar is now small, with 750+ followers beside it
deleted: giant 75% readout, 650+ follower count
findings: 0/0/0
score: n/a
gate: live /build shows small 75% and 750+ followers
unsure: Live after marketing deploy.

## Mixpanel 144k and verify | run 1 | 2026-08-18T07:50:00Z
agents: orchestrator
built: Mixpanel $144,000 on changelog and investors, autocapture and session replay on
deleted: Mixpanel pipeline not-secured line
findings: 0/0/0
score: n/a
gate: live changelog lists Mixpanel $144,000, site inits Mixpanel with replay
unsure: Mixpanel Live View needs a homepage hit after deploy.

## PostHog MCP and warehouse | run 1 | 2026-08-18T07:05:00Z
agents: orchestrator
built: Cursor MCP at mcp.posthog.com, Unvibe org project 562518 linked, warehouse connect links for Stripe Github Supabase
deleted: nothing
findings: 0/0/0
score: n/a
gate: MCP authenticated, production PostHog key live on unvibe-site after redeploy
unsure: Warehouse sources need Preston to finish the three connect pages, then source-setup can run.

## Hero tighter, muted videos | run 2 | 2026-08-18T06:52:00Z
agents: orchestrator
built: install padding wins over paper-section, Command U gap tighter, Typeform glass under curl, videos stay muted
deleted: leftover 1fr hero gap and auto unmute
findings: 0/0/0
score: n/a
gate: live hero countdown sits under Typeform, install Typeform matches curl, videos muted
unsure: none

## Hero tighter, muted videos | run 1 | 2026-08-17T22:52:00Z
agents: orchestrator
built: countdown up, Command U install closer, Typeform glass under curl, videos start muted
deleted: auto unmute on first click
findings: 0/0/0
score: n/a
gate: live hero countdown sits under Typeform, install Typeform matches curl, videos muted
unsure: none

## PostHog for Startups 50k | run 1 | 2026-08-17T22:47:00Z
agents: orchestrator
built: PostHog $50,000 on 18 AUG changelog and investors secured list
deleted: nothing
findings: 0/0/0
score: n/a
gate: live changelog and investors show PostHog for Startups $50,000
unsure: Mixpanel stays not awarded.

## Mixpanel credit not awarded | run 1 | 2026-08-17T18:26:00Z
agents: orchestrator
built: Mixpanel moved to investor pipeline as not secured
deleted: $144,000 Mixpanel from changelog and secured credits
findings: 0/0/0
score: n/a
gate: live investors and changelog do not claim Mixpanel $144,000
unsure: Site still sends named Mixpanel events. Session replay stays off.

## Mixpanel 18 Aug, OpenAI and Linear later | run 1 | 2026-08-17T17:48:00Z
agents: orchestrator
built: Mixpanel dated 18 AUG starred, OpenAI 16 AUG, Linear 14 AUG, no stars
deleted: OpenAI and Linear from the top of the changelog
findings: 0/0/0
score: n/a
gate: live changelog dates Mixpanel 18, OpenAI 16, Linear 14
unsure: none

## Star Mixpanel and GitLab | run 1 | 2026-08-17T16:41:00Z
agents: orchestrator
built: changelog stars Mixpanel and GitLab only
deleted: stars on OpenAI and Linear
findings: 0/0/0
score: n/a
gate: live changelog stars Mixpanel and GitLab
unsure: none

## Linear Founder Value Pack | run 1 | 2026-08-17T16:35:00Z
agents: orchestrator
built: Linear 6 months free, $4,500 on investors and changelog
deleted: nothing
findings: 0/0/0
score: n/a
gate: live investors and releases show Linear Founder Value Pack
unsure: Value is the founder-reported pack figure.

## OpenAI credit and copy toast | run 1 | 2026-08-17T16:22:00Z
agents: orchestrator
built: OpenAI $1,200 and Mixpanel $144,000 on investors and changelog, 3s copied toast
deleted: nothing
findings: 0/0/0
score: n/a
gate: live investors lists OpenAI, changelog pins it, copy shows bottom right toast
unsure: Mixpanel value is the 1 year credit the founder reported.

## Mixpanel browser SDK, named events | run 1 | 2026-08-17T16:10:00Z
agents: orchestrator
built: mixpanel-browser on the marketing site, init without autocapture or session replay
deleted: Mixpanel wizard autocapture true and record_sessions_percent 100
findings: 0/0/0
score: n/a
gate: live unvibe.site inits Mixpanel SDK, Verify Connection can see page_viewed
unsure: Desktop app is not wired.

## Mixpanel named events on the site | run 1 | 2026-08-17T15:10:00Z
agents: orchestrator
built: marketing Mixpanel via /api/analytics, page_viewed plus existing named events, no SDK
deleted: autocapture and session replay from the Mixpanel snippet
findings: 0/0/0
score: n/a
gate: live unvibe.site posts named events, Mixpanel Live View shows page_viewed
unsure: Desktop app is not wired. Token is server-only MIXPANEL_TOKEN.

## Investors top plus bold beta label | run 1 | 2026-08-17T21:36:00Z
agents: orchestrator
built: BetaInstall at top of investors, bold page copy, label Beta Testing App (30 AI Explanations)
deleted: investors download at bottom, Beta App (30 explanations)
findings: 0/0/0
score: n/a
gate: live investors label before ownership headline
unsure: Live after marketing deploy.

## Pricing checkout plus Composio | run 1 | 2026-08-18T04:10:00Z
agents: orchestrator
built: PricingPlans Start Pro/Team checkout, PlanManager auto checkout, Teams checkout enabled, Composio MCP
deleted: Join waitlist on /pricing
findings: 0/0/0
score: n/a
gate: live /pricing buttons are not Join waitlist
unsure: Linear Stripe GitHub Composio links need user auth. Team Stripe price IDs are not on unvibe-api yet. Enterprise remains contact.

## Composio ops playbooks | run 1 | 2026-08-18T06:24:00Z
agents: orchestrator
built: .cursor/skills/unvibe-ops/SKILL.md, .cursor/commands/ops.md, docs/automation/composio/playbooks.md, Unvibe ops Sheet, regrade Gmail draft
deleted: nothing
findings: 0/0/0
score: n/a
gate: weekly row and unsent draft exist. Linear labels wait on Composio auth
unsure: Linear GitHub GitLab Vercel Stripe Mixpanel still pending in Composio. Credit cap is 20 calls/month each for Linear PostHog Mixpanel GitLab OpenAI.

## Security checklist pass | run 1 | 2026-08-18T06:40:00Z
agents: orchestrator
built: webhook timestamp replay reject, HSTS, no-store on authed pages, Action SHA pins, consume_usage search_path, log scrub, auth rate limit, docs/security-checklist.md
deleted: floating @v4/@latest GitHub Action refs
findings: 0/0/0
score: n/a
gate: web tests for timestamp replay, log scrub, and auth rate limit
unsure: Founder MFA is a Supabase dashboard setting. Waitlist admin is still a Bearer token. CSP remains Next-compatible, not nonce-strict. Apply consume_usage search_path migration on staging.

## Beta waitlist email templates | run 1 | 2026-08-18T12:40:00Z
agents: orchestrator
built: waitlist and download emails with curl plus Typeform, docs/automation/emails/beta-waitlist.md
deleted: 3 month Pro claim in download mail, emoji heavy draft
findings: 0/0/0
score: n/a
gate: marketing email tests for curl, feedback URL, 1 week Pro
unsure: No send. Cold email not drafted. Reward is 1 week Pro after survey, matching the site, not 1 month.

## Home install beta block | run 1 | 2026-08-18T13:26:00Z
agents: orchestrator
built: centered curl and Typeform, white offer copy, smaller survey type than curl
deleted: left aligned black offer on home install
findings: 0/0/0
score: n/a
gate: visual, home #install
unsure: Investors page still uses ink on tone=page because it is not paper-install.

## Politer beta waitlist email | run 1 | 2026-08-18T13:28:00Z
agents: orchestrator
built: thank you for waitlisting, purple heart, softer bug ask in invite and download mail
deleted: nothing
findings: 0/0/0
score: n/a
gate: marketing email tests
unsure: Still not sent.

## Waitlist email send check | run 1 | 2026-08-18T13:50:00Z
agents: orchestrator
built: live Resend probe, founder and Mirzett send attempts
deleted: nothing
findings: 0/0/0
score: n/a
gate: Resend domains=0, 422 on both send attempts, email tests 29/29
unsure: Local marketing env has no Supabase. Production waitlist is not on the connected Regrade project. Outbound to waitlist people needs a verified unvibe.site sender in Resend.

## Resend Composio connect | run 1 | 2026-08-18T13:56:00Z
agents: orchestrator
built: Composio Resend alias unvibe-resend initiated, new key probed
deleted: nothing
findings: 0/0/0
score: n/a
gate: same Resend account, domains=0, Composio still initiated
unsure: Mirzett invite still blocked until unvibe.site is verified in Resend. Key was pasted in chat and should be rotated.

## Waitlist blast blocked | run 1 | 2026-08-18T14:01:00Z
agents: orchestrator
built: Composio Resend active check
deleted: nothing
findings: 0/0/0
score: n/a
gate: RESEND_LIST_DOMAINS returned 0 domains
unsure: Waitlist people cannot be emailed until unvibe.site is verified in Resend.

## Waitlist beta invites sent | run 1 | 2026-08-18T14:09:41Z
agents: orchestrator
built: 3 beta invites from waitlist@unvibe.site after domain verified
deleted: nothing
findings: 0/0/0
score: n/a
gate: Resend batch 3 ids, retrieve queued/sent
unsure: Local/prod waitlist store still not wired here. Sent the 3 real signups from founder alerts. Skipped test and founder rows. Set WAITLIST_FROM_EMAIL on Vercel to the verified sender.

## Night Lab disabled | run 1 | 2026-08-18T14:25:00Z
agents: orchestrator
built: gh workflow disable Unvibe Autonomous Night Lab
deleted: nothing
findings: 0/0/0
score: n/a
gate: workflow list shows disabled_manually
unsure: YAML still in the repo. Re-enable later with gh workflow enable if wanted.

## Windows 30 explanation trial | run 1 | 2026-08-19T11:54:00Z
agents: orchestrator
built: Windows Ctrl+C capture, install.ps1, Mac/Windows beta switch, same 30 explanation trial copy
deleted: Windows waitlist only FAQ
findings: 0/0/0
score: n/a
gate: marketing and app tests
unsure: Windows exe still needs packaging with UNVIBE_TRIAL_TOKEN and upload to v0.1.11-beta-onboard as Unvibe-0.1.11-win-x64-portable.exe

## Windows 30 explanation trial | run 2 | 2026-08-19T12:00:00Z
agents: orchestrator
built: removed duplicate prettyShortcut import in bar.tsx; app typecheck passes
deleted: /tmp/unvibe-api.prod.env after a Vercel env pull
findings: 0/0/0
score: n/a
gate: app typecheck
unsure: UNVIBE_TRIAL_TOKEN is Vercel Sensitive so this session cannot bake it. GitHub release still has only the Mac DMG. install.ps1 is not live until marketing deploys after the exe is uploaded.

## Windows trial push | run 1 | 2026-08-19T12:10:00Z
agents: orchestrator
built: counted /feedback redirect for email and app survey opens, os on copy, push Windows trial source without tokens or installers
deleted: nothing
findings: 0/0/0
score: n/a
gate: marketing tests
unsure: founder copy and fetch counts are live on /api/stats. /feedback counts after marketing deploy.
























