/**
 * The redesigned site's words and pictures (Design package-1106). Every string here is live site copy or a
 * Security-ruled line, and every picture is a real capture with its own version.
 */
import { CAPTURE_DIR, CAPTURE_VERSION, HERO_RECORDING, KEY_CHECK_SHOT, SHOT_CAPTION } from "@/data/homeGallery";
import { faqItems } from "@/data/faq";

export { HERO_RECORDING, KEY_CHECK_SHOT };

/**
 * Design CODE-SPEC §1b (Council R06): QA's 2x captures of 0.1.50 RC-2 on the sample repo (package-1106/assets/0150),
 * cropped to Design's boxes (no sidebar, no modal chrome), shown at most at 1x CSS (half their pixels).
 */
export const BRIEFS_SHOT = { src: "/unvibe/real/0150/briefs-card.webp", width: 770, height: 432, alt: "Unvibe Briefs: after-agent review, 3 files changed, +21 / -2. Review first: start with src/cart.js. What matters: src/cart.js +11 / -2, test/cart.test.js +6 / -0, README.md +4 / -0. Areas touched: root 2, test 1." };
export const BRIEFS_CAPTION = "Real screen, sample repo · Unvibe 0.1.50";
export const PRIVACY_SHOT = { src: "/unvibe/real/0150/privacy-card.webp", width: 750, height: 325, alt: "Unvibe Settings, Privacy & Data: Send code to Anthropic (Claude) is off; On-device secret scan is always on; the service never reads your repo; Include nearby files (Pro) is off." };
export const PRIVACY_CAPTION = "Real screen · Unvibe 0.1.50";
/** Security R-a, verbatim, under the Privacy shot only. */
export const PRIVACY_LINE = "Unvibe's server doesn't keep your code or train on it. The AI provider's terms cover what it keeps.";

export interface Shot {
  src: string;
  width: number;
  height: number;
  alt: string;
}

const PANEL = { width: 704, height: 905 };
const panel = (name: string, alt: string): Shot => ({ src: `${CAPTURE_DIR}/${name}.webp`, ...PANEL, alt });

export const HERO = {
  /* Design copy deck (agents/design/specs/copy-diet-2026-11-06.md, row 551). */
  h1: ["Understand the code", "your AI writes."] as const,
  /** The live lede; `{shortcut}` is the visitor's own shortcut, kept on one line with its comma. */
  ledeBefore: "Select code in any app. Press",
  ledeAfter: "Read it beside your editor.",
  download: { mac: "Download for Mac", windows: "Download for Windows" },
  tryIt: "Try it in your browser",
  /** Security re-OK (row 551, file 0100): the GO'd InstallBox line without ", so this is the smooth path". */
  installLine: "Paste into Terminal. Unvibe isn't notarized by Apple yet.",
} as const;

export const NAV = [
  { label: "Product", href: "/#product" },
  { label: "Resources", href: "/resources" },
  { label: "Pricing", href: "/pricing" },
  { label: "Changelog", href: "/releases" },
  { label: "About", href: "/about" },
] as const;

export const SHOTS = {
  beginner: panel("panel-beginner", "Unvibe's panel explaining the debounce sample at Beginner depth."),
  advanced: panel("panel-advanced", "Unvibe's panel explaining the same debounce sample at Advanced depth."),
  followUp: panel("panel-follow-up", "Unvibe's panel answering a follow-up question about the debounce sample under its explanation."),
  testMe: panel("panel-test-me", "Unvibe's Test me question about the debounce sample, with its answer choices."),
} as const;

/** "Real screen, sample code · Unvibe 0.1.xx" for each capture's own version (no scene mixes two versions). */
export const CAPTION = { v0149: SHOT_CAPTION, recording: HERO_RECORDING.caption, version: CAPTURE_VERSION } as const;

/** Security S-2 #225 SHOULD-R2: the old "Everything stays beside your code." read as a data claim above Keys. */
export const GALLERY_H2 = "It all happens beside your code.";

export const TRY = { h2: "Try it here.", lede: "Paste code. No download." } as const;

export const KEYS = {
  /** Security MUST-K1 (file 0152): K-b, as in Design round 06. The old "Your keys stay on your computer." was never approved. */
  h2: "Known key formats never leave your computer.",
  /** Security line B (file 0152), after the exact lede. */
  never: "Unvibe never changes your code.",
  lede: "The app checks your code for keys and tokens before it's sent.",
  more: { label: "What leaves your computer", href: "/privacy" },
} as const;

export const WORKS = {
  h2: "Works where you read code.",
  chips: ["Cursor", "VS Code", "Xcode", "Terminal"] as const,
  /** Security S-2 #225 NIT: Xcode is Mac-only, so html.os-win hides its chip (no unverified Windows editor added). */
  macOnly: ["Xcode"] as readonly string[],
} as const;

export const PRICING = { h2: "Free for Mac and Windows.", closedLine: "Payments open soon. Nothing is billed today.", link: { label: "Pricing", href: "/pricing" } } as const;

export const FAQ = {
  h2: "Questions",
  items: faqItems.filter((item) => ["which-shortcut", "editors", "sent", "accuracy"].includes(item.id)),
  more: { label: "Every question and answer", href: "/faq" },
} as const;
