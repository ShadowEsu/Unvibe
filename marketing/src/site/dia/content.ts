/**
 * Every visible string of direction D (Dia's structure, Unvibe purple; agents/design/refs/dia-20261106/plan/PLAN.md
 * rev 3, Preston's OK 6 Nov), in one place so Security reads one file. Sources: Security file 20261106-0936 (the 0936
 * GO list, the 17:46Z demo caption, the 17:50Z strings with MUST-D9 and SHOULD-D10, the 18:21Z first-look GO with
 * MUST-D11, the 18:51Z PLAN §5 GO with MUST-D12/D13) and the live copy the plan reuses word for word (pricingCopy,
 * WhatLeaves, faq.ts, productFacts, the code-explainer pages). The demo's own strings live in UnvibeDemo.tsx.
 */
import { KEPT } from "@/components/paper/WhatLeaves";
import { CAPTURE_DIR, KEY_CHECK_SHOT, SHOT_CAPTION } from "@/data/homeGallery";

export type Title = { before: string; em: string; after?: string };
export type OsText = string | { readonly mac: string; readonly windows: string };

/** The glass header (mock 19): FAQ is the existing /faq page, its label already live in the footer. */
export const D_NAV = [
  { label: "Product", href: "/" },
  { label: "Pricing", href: "/pricing" },
  { label: "Changelog", href: "/releases" },
  { label: "FAQ", href: "/faq" },
] as const;
export const D_NAV_CTA = "Download free";

export const D_HERO = {
  h1: "Understand the code your AI writes.",
  wordmark: "Unvibe",
  cta: "Download Unvibe for free",
  available: "Available for macOS and Windows",
  caption: "Unvibe 0.1.49 panel, recreated in HTML · sample code",
} as const;

/** Numbers (mock 02): the GO'd labels (0118, 18:51Z) with one live fact line each. "No" never counts. */
export const D_STATS = {
  label: "Unvibe in numbers",
  items: [
    { value: 4, label: "Depths, New to Advanced", fact: "New, Beginner, Intermediate and Advanced are free. Expert is part of Pro." },
    { value: 2, label: "Platforms, Mac and Windows", fact: "Mac (Apple silicon or Intel) or Windows 10 and 11 (x64)." },
    { value: 1, label: { mac: "Shortcut, Control+U", windows: "Shortcut, Ctrl+Alt+U" }, fact: "Control+U on a Mac, Ctrl+Alt+U on Windows, in any app." },
    { value: "No", label: "API key", fact: "No card and no API key." },
  ],
} as const;

export const D_STATEMENT = {
  label: "(The idea)",
  lines: ["Select code in any app.", "Press one shortcut.", "Unvibe explains it beside your editor,"],
  last: "at",
  em: "the depth you choose.",
} as const;

export const D_STEPS = {
  label: "(How it works)",
  h2: { before: "From selection to", em: "understanding", after: ", in three steps." } as Title,
  items: [
    { n: "(01)", title: "Select code in any app", body: { mac: "Cursor, VS Code, Xcode, Terminal: wherever you read code.", windows: "Cursor, VS Code, Terminal: wherever you read code." } },
    { n: "(02)", title: { mac: "Press Control+U", windows: "Press Ctrl+Alt+U" }, body: "The app checks your code for keys and tokens before it's sent." },
    { n: "(03)", title: "Read it at your depth, then Test me", body: "New to Advanced, beside your editor. Test me asks up to 3 questions." },
  ],
} as const;

export const D_BRIEF = {
  label: "(Briefs)",
  kicker: "After-agent review",
  h2: { before: "Changes,", em: "briefed", after: " in plain English." } as Title,
  note: "Built from local git on this computer.",
  credit: "Wisteria, Claude Monet, c. 1925 · public domain",
  /** MUST-D11: the public 0.1.49 Brief (0149/briefs-open.webp), cropped to the Brief card: no sidebar, no path. */
  shot: { src: "/d/briefs-open-card.webp", width: 591, height: 336, alt: "An Unvibe Brief: 1 file changed in a sample app, what to review first and what matters." },
  caption: "Real screen, sample repo · Unvibe 0.1.49",
} as const;

const PANEL = { width: 704, height: 905 };

/** Four cards (mock 06): each real 0.1.49 capture cropped in CSS to the part its card names (capture pixels). */
export const D_CARDS = {
  label: "(In the panel)",
  h2: { before: "Made for", em: "learning", after: " the code you ship." } as Title,
  items: [
    { n: "(01)", title: "Pick your depth", body: "Beginner gets the plain idea. Advanced gets the mechanism.", shot: { src: `${CAPTURE_DIR}/panel-advanced.webp`, alt: "Unvibe's panel at Advanced depth: the depth row and the selected debounce code.", crop: { x: 72, y: 128, w: 632, h: 300 } } },
    { n: "(02)", title: "Ask a follow-up", body: "Why does this exist? What breaks if I remove it?", shot: { src: `${CAPTURE_DIR}/panel-follow-up.webp`, alt: "Unvibe's panel: the answer's last lines, the Understand, Explain differently and Test me buttons, and the follow-up box.", crop: { x: 72, y: 648, w: 632, h: 257 } } },
    { n: "(03)", title: "Test me", body: "Test me asks up to 3 questions about the code you just read.", shot: { src: `${CAPTURE_DIR}/panel-test-me.webp`, alt: "Unvibe's Test me question about the debounce sample, with its answer choices.", crop: { x: 404, y: 128, w: 300, h: 456 } } },
    { n: "(04)", title: "Works beside any editor", body: { mac: "Cursor, VS Code, Xcode, Terminal: wherever you read code.", windows: "Cursor, VS Code, Terminal: wherever you read code." }, editors: [{ name: "Cursor" }, { name: "VS Code" }, { name: "Xcode", macOnly: true }, { name: "Terminal" }] },
  ],
  caption: "Real screens, sample code · Unvibe 0.1.49",
} as const;

/** Then prove it (mock 07, revision 2: violet): three rows of live strings, the Library and Test me captures. */
export const D_SPLIT = {
  label: "(Test me)",
  h2: { before: "Then prove you", em: "understood", after: " it." } as Title,
  rows: [
    { title: "Test me", body: "Test me asks up to 3 questions about the code you just read." },
    { title: "Library", body: { mac: "Lessons you keep are saved to your Library on this Mac.", windows: "Keep the lessons you want in your Library, saved on this PC." } },
    { title: "Today", body: "The Today page sets a small daily goal: explain one piece of code and answer one question." },
  ],
  library: { src: `${CAPTURE_DIR}/library.webp`, width: 704, height: 440, alt: "Unvibe's Library listing 4 saved explanations from today.", caption: `Library · ${SHOT_CAPTION}` },
  shot: { src: `${CAPTURE_DIR}/panel-test-me.webp`, ...PANEL, alt: "Unvibe's Test me question about the debounce sample, with its answer choices.", caption: `Test me · ${SHOT_CAPTION}` },
  credit: "Lilacs in the Sun, Claude Monet, 1873 · public domain",
} as const;

/** MUST-D9: the live /about keys line. The list is the live WhatLeaves "Stays on your computer", word for word. */
export const D_PRIVACY = {
  label: "(Privacy)",
  h2: { before: "With you in", em: "control" } as Title,
  lines: ["Unvibe never changes your code.", "Unvibe checks for keys and tokens on your computer first, and a known key stops the request."],
  keptTitle: "Stays on your computer",
  kept: [KEPT[0], KEPT[1], KEPT[3]],
  more: { label: "What leaves your computer", href: "/privacy" },
  shot: { ...KEY_CHECK_SHOT, caption: `Key check · ${SHOT_CAPTION}` },
} as const;

/** What you get (mock 16): the pricing card features word for word; the H2 and labels are rev-2 strings. */
export const D_GET_TABLE = {
  label: "(What you get)",
  h2: { before: "Free does the", em: "learning", after: " part." } as Title,
  lead: "Free needs no card and no API key.",
  library: { src: `${CAPTURE_DIR}/library.webp`, width: 704, height: 440, alt: "Unvibe's Library listing 4 saved explanations from today.", caption: `Library · ${SHOT_CAPTION}` },
  all: { label: "See all plans", href: "/pricing" },
} as const;

/** Short answers (mock 17): 7 faq.ts items, word for word, the first open. */
export const D_FAQ = {
  label: "(FAQ)",
  h2: "Short answers.",
  more: { label: "Every question and answer", href: "/faq" },
  ids: ["what-is-it", "editors", "sent", "levels", "free", "windows", "accuracy"],
} as const;

export const D_CLOSE = { h2: { before: "Ready to understand your", em: "code", after: "?" } as Title } as const;

/** /beta (mock 11; Security 18:51Z GO, MUST-D12 OS-aware shortcut, SHOULD-D15 "allow access" Mac only). */
export const D_GET = {
  h1: "Get Unvibe",
  sub: "Free for Mac and Windows. Three steps.",
  steps: [
    "Download for your computer",
    { mac: "Open it and allow access", windows: "Open it" },
    { mac: "Select code, press Control+U", windows: "Select code, press Ctrl+Alt+U" },
  ] as readonly OsText[],
  help: "Install help",
} as const;

/**
 * The thank-you state after a one-click download (Preston, 6 Nov). NEW strings for Security: the heading, the lede
 * and the two links. The steps under them are InstallBox's live first-open steps.
 */
export const D_THANKS = {
  h1: "Your download has started.",
  file: (label: string) => `Unvibe 0.1.49 for ${label}.`,
  lede: "Unvibe isn't notarized by Apple yet, so open it the first time with these steps.",
  ledeWindows: "The Windows build isn't code-signed yet, so open it the first time with these steps.",
  again: "Didn't start? Download again",
  intel: "Intel Mac?",
  arm: "Apple silicon Mac?",
  windows: "Windows?",
  mac: "Mac?",
  here: "Download here",
} as const;

/** The footer (mock 09), every link of the live footer (MUST-D6), regrouped. */
export const D_FOOT = [
  { h: "Product", links: [["Download", "/beta"], ["Pricing", "/pricing"], ["Changelog", "/releases"], ["Explain code", "/explain"], ["Code explainer for Mac", "/code-explainer-mac"], ["Code explainer for Windows", "/code-explainer-windows"], ["Use cases", "/use-cases"]] },
  { h: "Resources", links: [["Install help", "/install-help"], ["FAQ", "/faq"], ["Resources", "/resources"], ["Privacy", "/privacy"], ["Terms", "/terms"], ["Refunds", "/refund"], ["Open-source notices", "/licenses"]] },
  { h: "Company", links: [["About", "/about"], ["Building Unvibe", "/build"], ["Investors", "/investors"], ["Listed on", "/listed-on"], ["Contact", "mailto:support@unvibe.site"]] },
] as const;

export const D_ART_CREDITS = "Photo: Tim Marshall (Unsplash), CC0, recoloured · Paintings, public domain: Claude Monet, Lilacs in the Sun, 1873 · Claude Monet, Wisteria, c. 1925 · Vincent van Gogh, Irises, 1889";
