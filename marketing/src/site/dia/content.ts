/**
 * LAB ONLY (branch unvibe-site/dia-lab): every visible string of direction D (Dia's structure, Unvibe purple), in one
 * place so Security reads one file. Security file 20261106-0936: the 0936 list, the 17:47Z demo caption and the
 * 17:50Z dagger strings (with MUST-D9 and SHOULD-D10 applied) are GO. The demo's own strings live in UnvibeDemo.tsx
 * (round-06 app.html + the real 0.1.49 panel).
 */
import { INSTALL_COPY } from "@/components/paper/InstallBox";

export type Title = { before: string; em: string; after?: string };

export const D_NAV = [
  { label: "Product", href: "/lab/d" },
  { label: "Pricing", href: "/lab/d/pricing" },
  { label: "Changelog", href: "/releases" },
] as const;
export const D_NAV_CTA = "Download free";

export const D_HERO = {
  h1: "Understand the code your AI writes.",
  wordmark: "Unvibe",
  cta: "Download Unvibe for free",
  available: "Available for macOS and Windows",
  caption: "Unvibe 0.1.49 panel, recreated in HTML · sample code",
} as const;

/** OS-aware download: a Mac opens /beta (the Terminal path), Windows downloads the .exe (#225 ruling). */
export const D_DOWNLOAD = { mac: "/beta", windows: INSTALL_COPY.windows.fileHref } as const;

/** True set only (Design's H spec): New to Advanced are free (Expert is Pro), Mac + Windows, one shortcut, no key. */
export const D_STATS = [
  { value: 4, label: "depths, New to Advanced" },
  { value: 2, label: "platforms, Mac and Windows" },
  { value: 1, label: "shortcut" },
  { value: 0, label: "API keys needed" },
] as const;

export const D_STATEMENT = {
  label: "(The idea)",
  lines: ["Select code in any app.", "Press one shortcut.", "Vibe explains it beside your editor,", "at the depth you choose."],
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
  credit: "Wisteria, Claude Monet, c. 1925",
  /** MUST-D11: the public 0.1.49 Brief (origin/main 0149/briefs-open.webp), cropped to the Brief card: no sidebar name, no path. */
  shot: { src: "/d/briefs-open-card.webp", width: 591, height: 336, alt: "An Unvibe Brief: 1 file changed in a sample app, what to review first and what matters." },
  caption: "Real screen, sample repo · Unvibe 0.1.49",
} as const;

/** Four cards from real 0.1.49 captures (Design's map, section 4). */
export const D_CARDS = {
  label: "(In the panel)",
  h2: { before: "Made for", em: "learning", after: " the code you ship." } as Title,
  items: [
    { n: "(01)", title: "Pick your depth", body: "Beginner gets the plain idea. Advanced gets the mechanism.", shot: { src: "/unvibe/real/0149/panel-advanced.webp", alt: "Unvibe's panel explaining the debounce sample at Advanced depth." } },
    { n: "(02)", title: "Ask a follow-up", body: "Why does this exist? What breaks if I remove it?", shot: { src: "/unvibe/real/0149/panel-follow-up.webp", alt: "Unvibe answering a follow-up question about the debounce sample." } },
    { n: "(03)", title: "Test me", body: "Test me asks up to 3 questions about the code you just read.", shot: { src: "/unvibe/real/0149/panel-test-me.webp", alt: "Unvibe's Test me question about the debounce sample, with its answer choices." } },
    { n: "(04)", title: "Works beside any editor", body: { mac: "Cursor, VS Code, Xcode, Terminal: wherever you read code.", windows: "Cursor, VS Code, Terminal: wherever you read code." }, shot: { src: "/unvibe/real/0149/panel-beginner.webp", alt: "Unvibe's panel explaining the debounce sample at Beginner depth." } },
  ],
  caption: "Real screens, sample code · Unvibe 0.1.49",
} as const;

export const D_SPLIT = {
  label: "(Test me)",
  h2: { before: "Then prove you", em: "understood", after: " it." } as Title,
  title: "Test me",
  body: "Test me asks up to 3 questions about the code you just read.",
  shot: { src: "/unvibe/real/0149/panel-test-me.webp", width: 622, height: 800, alt: "Unvibe's Test me question about the debounce sample, with its answer choices." },
  credit: "Lilacs in the sun, Claude Monet, 1873",
  caption: "Real screen, sample code · Unvibe 0.1.49",
} as const;

/** MUST-D9: the live /about line, never "Known key formats never leave your computer." */
export const D_PRIVACY = {
  label: "(Privacy)",
  h2: { before: "With you in", em: "control" } as Title,
  lines: ["Unvibe never changes your code.", "Unvibe checks for keys and tokens on your computer first, and a known key stops the request."],
  more: { label: "What leaves your computer", href: "/privacy" },
} as const;

export const D_CLOSE = { h2: { before: "Ready to understand your", em: "code", after: "?" } as Title } as const;

export const D_FOOT = [
  { h: "Product", links: [["Download", "/beta"], ["Pricing", "/lab/d/pricing"], ["Changelog", "/releases"], ["Explain code", "/explain"], ["Use cases", "/use-cases"]] },
  { h: "Resources", links: [["Install help", "/install-help"], ["FAQ", "/faq"], ["Resources", "/resources"], ["Privacy", "/privacy"], ["Terms", "/terms"], ["Refunds", "/refund"], ["Open-source notices", "/licenses"]] },
  { h: "Company", links: [["About", "/about"], ["Building Unvibe", "/build"], ["Investors", "/investors"], ["Listed on", "/listed-on"], ["Contact", "mailto:support@unvibe.site"]] },
] as const;

export const D_ART_CREDITS = "Photo: Tim Marshall (Unsplash), CC0, recoloured · Paintings, public domain: Claude Monet, Lilacs in the sun, 1873 · Claude Monet, Wisteria, c. 1925 · Vincent van Gogh, Irises, 1889";
