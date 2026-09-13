import fs from "node:fs/promises";
import path from "node:path";
import { Presentation, PresentationFile } from "/Users/prestonjaysusanto/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs";

const OUT = "/Users/prestonjaysusanto/Unvibe/output/presentations";
const TMP = "/Users/prestonjaysusanto/Unvibe/tmp/unvibe-pitch-20260831/rendered";
const ASSET = "/Users/prestonjaysusanto/Desktop/Unvibe Resources";
const APP = path.join(ASSET, "new app");
const WEB = path.join(ASSET, "New Website August");
const LOGO = "/Users/prestonjaysusanto/Unvibe/marketing/public/brand/icon-1024.png";

const C = {
  ink: "#0A0710",
  deep: "#120B1A",
  deep2: "#181022",
  paper: "#F7F1EA",
  white: "#FFFDF9",
  muted: "#B8AABD",
  faint: "#766A7D",
  purple: "#A57BF3",
  purple2: "#7446D8",
  pink: "#E65CA7",
  blue: "#3F65E8",
  orange: "#D86D3D",
  green: "#4BC084",
  line: "#33283D",
};

const F = { sans: "Helvetica Neue", serif: "Helvetica Neue", mono: "Helvetica Neue" };
const W = 1280, H = 720;

async function bytes(file) {
  const b = await fs.readFile(file);
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
}

function box(slide, x, y, w, h, fill = C.deep2, line = C.line, radius = 18) {
  return slide.shapes.add({
    geometry: "roundRect",
    position: { left: x, top: y, width: w, height: h },
    fill,
    line: { style: "solid", fill: line, width: 1 },
    borderRadius: radius,
  });
}

function text(slide, value, x, y, w, h, size = 24, color = C.white, opts = {}) {
  const s = slide.shapes.add({
    geometry: "textbox",
    position: { left: x, top: y, width: w, height: h },
    fill: "none",
    line: { style: "solid", fill: "none", width: 0 },
  });
  s.text = value;
  s.text.style = {
    fontFamily: opts.fontFamily || F.sans,
    fontSize: size,
    color,
    bold: Boolean(opts.bold),
    italic: Boolean(opts.italic),
    alignment: opts.alignment || "left",
  };
  return s;
}

function eyebrow(slide, value, x = 64, y = 44, w = 520) {
  return text(slide, value.toUpperCase(), x, y, w, 28, 11, C.purple, { bold: true, fontFamily: F.mono });
}

function title(slide, value, y = 82, w = 760, x = 64, size = 44) {
  return text(slide, value, x, y, w, 116, size, C.white, { bold: true });
}

function body(slide, value, x, y, w, h, size = 18, color = C.muted) {
  return text(slide, value, x, y, w, h, size, color);
}

function footer(slide, index, label = "UNVIBE · INVESTOR DECK") {
  text(slide, label, 64, 682, 300, 18, 8, C.faint, { bold: true, fontFamily: F.mono });
  text(slide, String(index).padStart(2, "0"), 1190, 681, 28, 18, 9, C.faint, { bold: true, fontFamily: F.mono, alignment: "right" });
}

function darkBase(slide, index, label) {
  slide.background.fill = C.ink;
  slide.shapes.add({ geometry: "rect", position: { left: 0, top: 0, width: 8, height: H }, fill: C.purple2, line: { style: "solid", fill: "none", width: 0 } });
  slide.shapes.add({ geometry: "rect", position: { left: 8, top: 0, width: 1272, height: 5 }, fill: C.orange, line: { style: "solid", fill: "none", width: 0 } });
  slide.shapes.add({ geometry: "line", position: { left: 64, top: 658, width: 1152, height: 0 }, fill: "none", line: { style: "solid", fill: C.line, width: 1 } });
  footer(slide, index, label);
}

async function image(slide, file, x, y, w, h, opts = {}) {
  return slide.images.add({
    blob: await bytes(file),
    contentType: "image/png",
    alt: opts.alt || path.basename(file),
    fit: opts.fit || "cover",
    position: { left: x, top: y, width: w, height: h },
    geometry: opts.geometry || "roundRect",
    borderRadius: opts.radius || 18,
  });
}

function note(slide, presenter, sources = []) {
  const lines = [presenter, "", "[Sources]", ...sources.map((s) => `- ${s}`), "[/Sources]"];
  slide.speakerNotes.textFrame.setText(lines);
  slide.speakerNotes.setVisible(false);
}

function metric(slide, value, label, x, y, w, accent = C.purple) {
  text(slide, value, x, y, w, 58, 38, accent, { bold: true });
  text(slide, label, x, y + 52, w, 44, 13, C.muted, { bold: true });
}

function pill(slide, label, x, y, w, fill = C.deep2, color = C.white, line = C.line) {
  const p = box(slide, x, y, w, 34, fill, line, 17);
  text(slide, label, x + 10, y + 8, w - 20, 18, 10, color, { bold: true, fontFamily: F.mono, alignment: "center" });
  return p;
}

function sectionNumber(slide, n) {
  text(slide, String(n).padStart(2, "0"), 1162, 38, 58, 30, 13, C.purple, { bold: true, fontFamily: F.mono, alignment: "right" });
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  await fs.mkdir(TMP, { recursive: true });
  const deck = Presentation.create({ slideSize: { width: W, height: H } });

  // 1 — Cover
  {
    const s = deck.slides.add();
    darkBase(s, 1, "UNVIBE · PRIVATE MAC BETA");
    const logoFrame = box(s, 64, 48, 50, 50, C.white, C.white, 14);
    await image(s, LOGO, 72, 56, 34, 34, { fit: "contain", radius: 6, alt: "Unvibe logo" });
    text(s, "UNVIBE", 128, 60, 150, 24, 11, C.white, { bold: true, fontFamily: F.mono });
    text(s, "THE COMPREHENSION LAYER FOR AI-WRITTEN CODE", 64, 142, 600, 28, 11, C.purple, { bold: true, fontFamily: F.mono });
    text(s, "Unvibe makes AI-written\ncode understandable.", 64, 186, 600, 152, 48, C.white, { bold: true });
    body(s, "A Mac-first product that turns every AI-generated change into understanding, verification, and retained project knowledge.", 64, 360, 550, 92, 19, C.muted);
    pill(s, "SELECT → EXPLAIN → ASK → TEST → SAVE", 64, 478, 382, C.deep2, C.white, C.purple2);
    text(s, "Preston Susanto · Founder", 64, 545, 360, 24, 14, C.white, { bold: true });
    text(s, "Private beta · August 2026", 64, 574, 360, 22, 11, C.faint, { fontFamily: F.mono });
    await image(s, path.join(APP, "Screenshot 2026-08-17 at 6.50.24 PM.png"), 700, 104, 500, 500, { alt: "Unvibe progress dashboard" });
    note(s, "Open with the category: AI code generation is abundant; code ownership is becoming scarce.", [
      `User-provided product screenshot: ${path.join(APP, "Screenshot 2026-08-17 at 6.50.24 PM.png")}`,
      `Brand asset: ${LOGO}`,
      `Prior pitch source: ${path.join(ASSET, "Unvibe_Pitch_Deck.pdf")}`,
      "https://sequoiacap.com/article/writing-a-business-plan",
      "https://www.ycombinator.com/blog/guide-to-demo-day-pitches/",
    ]);
  }

  // 2 — Why now
  {
    const s = deck.slides.add(); darkBase(s, 2); sectionNumber(s, 2);
    eyebrow(s, "WHY NOW");
    title(s, "The faster AI ships code,\nthe harder ownership becomes.", 90, 690, 64, 40);
    body(s, "The bottleneck moved from generating code to verifying, explaining, and remembering what shipped.", 64, 232, 600, 74, 18);
    metric(s, "84%", "use or plan to use AI in development", 64, 350, 230);
    metric(s, "66%", "say AI answers are almost right", 330, 350, 230, C.pink);
    metric(s, "45%", "spend longer debugging AI code", 596, 350, 220, C.orange);
    metric(s, "3%", "highly trust AI output", 862, 350, 220, C.blue);
    box(s, 64, 514, 1050, 90, C.deep2, C.line, 18);
    text(s, "Generation is solved. Ownership is not.", 94, 539, 830, 42, 27, C.white, { bold: true });
    text(s, "That gap becomes a learning, reliability, and governance problem.", 760, 538, 320, 44, 13, C.muted, { alignment: "right" });
    note(s, "Establish a structural market shift, not a temporary feature gap.", [
      "https://survey.stackoverflow.co/2025/ai",
      "https://www.ycombinator.com/blog/this-brief-guide-is-a-summary-of-what-startup-founders-need-to-know-about-raising-the-seed-funds-critical-to-getting-their-company-off-the-ground",
      "https://email.docsend.com/hubfs/The%20Pre-Seed%20Round%20Defined.pdf",
    ]);
  }

  // 3 — Solution
  {
    const s = deck.slides.add(); darkBase(s, 3); sectionNumber(s, 3);
    eyebrow(s, "PRODUCT");
    title(s, "Review the change.\nLearn it before it ships.", 84, 560, 64, 40);
    body(s, "Highlight code in Cursor or VS Code, press ⌘U, and get a contextual explanation without leaving the project.", 64, 228, 500, 88, 18);
    const steps = [
      ["01", "SELECT", "Exact code, file, or change"],
      ["02", "EXPLAIN", "Five depth levels"],
      ["03", "ASK", "Context-aware follow-up"],
      ["04", "TEST", "One comprehension check"],
      ["05", "SAVE", "Learning becomes history"],
    ];
    steps.forEach((it, i) => {
      const x = 64 + i * 218;
      box(s, x, 380, 196, 154, i === 1 ? "#241735" : C.deep2, i === 1 ? C.purple : C.line, 16);
      text(s, it[0], x + 18, 398, 46, 22, 10, C.purple, { bold: true, fontFamily: F.mono });
      text(s, it[1], x + 18, 434, 150, 26, 16, C.white, { bold: true });
      text(s, it[2], x + 18, 478, 156, 44, 12, C.muted);
      if (i < 4) text(s, "→", x + 196, 438, 22, 24, 15, C.faint, { alignment: "center" });
    });
    pill(s, "LOCAL SECRET FILTER BEFORE EVERY REMOTE REQUEST", 64, 564, 430, C.deep2, C.green, C.line);
    note(s, "Explain the full loop in under 30 seconds. Emphasize that Unvibe is not another generator.", [
      "/Users/prestonjaysusanto/Unvibe/AGENTS.md",
      "/Users/prestonjaysusanto/Unvibe/docs/architecture.md",
      "/Users/prestonjaysusanto/Unvibe/docs/privacy.md",
    ]);
  }

  // 4 — Product evidence
  {
    const s = deck.slides.add(); darkBase(s, 4); sectionNumber(s, 4);
    eyebrow(s, "PRODUCT IN HANDS");
    title(s, "One layer. Three moments of value.", 82, 760, 64, 40);
    body(s, "Review the change now. Revisit it later. Prove you retained it.", 64, 170, 650, 40, 18);
    await image(s, path.join(APP, "Screenshot 2026-08-17 at 6.50.21 PM.png"), 64, 242, 350, 350, { alt: "Ask Unvibe AI surface" });
    await image(s, path.join(APP, "Screenshot 2026-08-17 at 6.50.10 PM.png"), 465, 242, 350, 350, { alt: "Unvibe learning library" });
    await image(s, path.join(APP, "Screenshot 2026-08-17 at 6.50.17 PM.png"), 866, 242, 350, 350, { alt: "Unvibe quiz surface" });
    pill(s, "UNDERSTAND", 155, 607, 168, "#23172F", C.white, C.purple2);
    pill(s, "RETAIN", 556, 607, 168, "#23172F", C.white, C.purple2);
    pill(s, "PROVE", 957, 607, 168, "#23172F", C.white, C.purple2);
    note(s, "These are current product screenshots, not mockups. Walk left to right.", [
      `User-provided screenshot: ${path.join(APP, "Screenshot 2026-08-17 at 6.50.21 PM.png")}`,
      `User-provided screenshot: ${path.join(APP, "Screenshot 2026-08-17 at 6.50.10 PM.png")}`,
      `User-provided screenshot: ${path.join(APP, "Screenshot 2026-08-17 at 6.50.17 PM.png")}`,
    ]);
  }

  // The retention system is demonstrated on the product and proof slides; avoid a repetitive slide.
  if (false) {
    const s = deck.slides.add(); darkBase(s, 5); sectionNumber(s, 5);
    eyebrow(s, "THE COMPOUNDING ASSET");
    text(s, "Every explanation becomes\na learning record.", 64, 88, 570, 180, 40, C.white, { bold: true });
    body(s, "Most AI tools forget the project when the chat closes. Unvibe turns review into durable, measurable knowledge.", 64, 282, 520, 60, 17);
    const benefits = [
      ["History", "What was reviewed and understood"],
      ["Concepts", "Patterns that still need practice"],
      ["Streaks", "A visible habit of code ownership"],
      ["Progress", "Lines reviewed versus understood"],
    ];
    benefits.forEach((b, i) => {
      const y = 360 + i * 62;
      text(s, String(i + 1).padStart(2, "0"), 64, y + 4, 38, 20, 10, C.purple, { bold: true, fontFamily: F.mono });
      text(s, b[0], 112, y, 120, 24, 15, C.white, { bold: true });
      text(s, b[1], 244, y, 320, 30, 13, C.muted);
      s.shapes.add({ geometry: "line", position: { left: 64, top: y + 42, width: 500, height: 0 }, fill: "none", line: { style: "solid", fill: C.line, width: 1 } });
    });
    await image(s, path.join(APP, "Screenshot 2026-08-17 at 6.50.24 PM.png"), 660, 112, 540, 500, { alt: "Unvibe progress and streak dashboard" });
    note(s, "The strategic asset is the longitudinal learning graph, not the one-off explanation.", [
      `User-provided screenshot: ${path.join(APP, "Screenshot 2026-08-17 at 6.50.24 PM.png")}`,
      "/Users/prestonjaysusanto/Unvibe/AGENTS.md",
    ]);
  }

  // 5 — Differentiation
  {
    const s = deck.slides.add(); darkBase(s, 5); sectionNumber(s, 5);
    eyebrow(s, "POSITIONING");
    title(s, "Generation creates output.\nUnvibe creates ownership.", 85, 690, 64, 40);
    const rows = [
      ["Coding agents", "Generate and edit code", "Do not build learning memory"],
      ["Generic chat", "Explain pasted snippets", "Misses workflow and project context"],
      ["Course platforms", "Teach fixed curricula", "Disconnected from what shipped"],
      ["Unvibe", "Explains your selected change", "Tests, saves, and tracks ownership"],
    ];
    rows.forEach((r, i) => {
      const y = 286 + i * 74;
      box(s, 64, y, 1110, 60, i === 3 ? "#251735" : C.deep2, i === 3 ? C.purple : C.line, 12);
      text(s, r[0], 86, y + 19, 200, 24, 14, i === 3 ? C.purple : C.white, { bold: true });
      text(s, r[1], 330, y + 19, 355, 24, 13, C.muted);
      text(s, r[2], 730, y + 19, 410, 24, 13, i === 3 ? C.white : C.faint);
    });
    pill(s, "WORKFLOW CONTEXT + ACTIVE RECALL + RETENTION", 64, 606, 420, C.deep2, C.green, C.line);
    note(s, "Position Unvibe against adjacent categories without claiming feature-for-feature parity.", [
      `Prior competition framing: ${path.join(ASSET, "Unvibe_Pitch_Deck.pdf")}`,
      "/Users/prestonjaysusanto/Unvibe/AGENTS.md",
      "https://sequoiacap.com/article/writing-a-business-plan",
    ]);
  }

  // 6 — Traction
  {
    const s = deck.slides.add(); darkBase(s, 6); sectionNumber(s, 6);
    eyebrow(s, "EARLY PROOF");
    title(s, "Small launch. Real signal.", 86, 600, 64, 44);
    metric(s, "30+", "historical early-access signups*", 64, 230, 210);
    metric(s, "62", "Smol Startup upvotes", 310, 230, 210, C.pink);
    metric(s, "#1", "Smol Startup Daily Winner", 556, 230, 230, C.orange);
    metric(s, "136", "unique site visitors", 822, 230, 210, C.blue);
    box(s, 64, 402, 540, 180, C.deep2, C.line, 18);
    text(s, "“The test option is very useful to recap what was learnt.”", 90, 426, 470, 72, 21, C.white, { italic: true });
    text(s, "Sharice Gustian · private beta · 9/10", 90, 530, 430, 22, 11, C.purple, { bold: true, fontFamily: F.mono });
    box(s, 636, 402, 540, 180, C.deep2, C.line, 18);
    text(s, "“The explanation depth and customization felt genuinely creative.”", 662, 426, 470, 72, 21, C.white, { italic: true });
    text(s, "Om Anand Khaunte · private beta · 7/10", 662, 530, 430, 22, 11, C.purple, { bold: true, fontFamily: F.mono });
    text(s, "*Founder-reported across the pre-reset waitlist and early beta intake; current live store is tracked separately.", 64, 618, 900, 20, 9, C.faint, { fontFamily: F.mono });
    note(s, "Lead with external proof, then show qualitative retention signals. Do not present credits as traction.", [
      "https://smolstartup.com/projects/unvibe",
      "https://unvibe.site/api/stats?include=waitlist",
      "User-provided beta feedback: Sharice Gustian, 29 Jul 2026",
      "User-provided beta feedback: Om Anand Khaunte, 25 Jul 2026",
      "Founder-reported historical early-access total supplied in this request; live store count checked 31 Aug 2026",
      "https://www.docsend.com/blog/data-driven-answers-to-frequently-asked-questions-on-startup-fundraising/",
    ]);
  }

  // 7 — Market wedge
  {
    const s = deck.slides.add(); darkBase(s, 7); sectionNumber(s, 7);
    eyebrow(s, "MARKET WEDGE");
    title(s, "Start where AI speed\ncreates the sharpest pain.", 86, 630, 64, 42);
    const nodes = [
      ["01", "AI-first students", "Ship quickly, learn unevenly"],
      ["02", "Solo builders", "Own every line they deploy"],
      ["03", "Developer teams", "Need shared comprehension"],
      ["04", "Regulated teams", "Need evidence and review"],
    ];
    nodes.forEach((n, i) => {
      const x = 64 + i * 282;
      const top = 326;
      box(s, x, top, 250, 196, i === 0 ? "#251735" : C.deep2, i === 0 ? C.purple : C.line, 18);
      text(s, n[0], x + 20, top + 20, 44, 24, 11, C.purple, { bold: true, fontFamily: F.mono });
      text(s, n[1], x + 20, top + 66, 205, 46, 19, C.white, { bold: true });
      text(s, n[2], x + 20, top + 126, 205, 48, 13, C.muted);
    });
    body(s, "The recurring unit is a review, not a course. The expansion path follows code responsibility from individual learning to team assurance.", 64, 564, 980, 54, 15, C.muted);
    note(s, "Describe a credible beachhead before discussing enterprise expansion.", [
      "https://survey.stackoverflow.co/2025/ai",
      `Market framing adapted from ${path.join(ASSET, "Unvibe_Pitch_Deck.pdf")}`,
      "https://sequoiacap.com/article/writing-a-business-plan",
    ]);
  }

  // 8 — Business model
  {
    const s = deck.slides.add(); darkBase(s, 8); sectionNumber(s, 8);
    eyebrow(s, "BUSINESS MODEL");
    title(s, "Free to build the habit.\nPaid when the project grows.", 84, 660, 64, 42);
    const plans = [
      ["FREE", "$0", "Core selected-code review\nSaved learning + study"],
      ["PRO", "$8/mo", "More reviews + AI questions\nPersonal learning history"],
      ["TEAM", "$8/seat", "Shared workspace\n2-seat minimum"],
      ["ENTERPRISE", "Custom", "Annual contract\nIntegrations + support"],
    ];
    plans.forEach((p, i) => {
      const x = 64 + i * 282;
      box(s, x, 308, 250, 254, i === 1 ? "#251735" : C.deep2, i === 1 ? C.purple : C.line, 18);
      text(s, p[0], x + 20, 330, 180, 22, 10, C.purple, { bold: true, fontFamily: F.mono });
      text(s, p[1], x + 20, 382, 205, 50, 28, C.white, { bold: true });
      text(s, p[2], x + 20, 462, 205, 72, 13, C.muted);
      if (i === 2) pill(s, "COMING SOON", x + 20, 526, 130, C.deep2, C.faint, C.line);
      if (i === 3) pill(s, "CONTACT SALES", x + 20, 526, 130, C.deep2, C.faint, C.line);
    });
    text(s, "Annual plans discount 25%. Model access is included—no provider API key required.", 64, 606, 930, 24, 13, C.muted);
    note(s, "Show monetization clarity while separating currently available tiers from planned tiers.", [
      "/Users/prestonjaysusanto/Unvibe/marketing/src/components/redesign/PricingPlans.tsx",
      "/Users/prestonjaysusanto/Unvibe/marketing/src/data/faq.ts",
      "https://www.ycombinator.com/blog/this-brief-guide-is-a-summary-of-what-startup-founders-need-to-know-about-raising-the-seed-funds-critical-to-getting-their-company-off-the-ground",
    ]);
  }

  // 9 — Distribution
  {
    const s = deck.slides.add(); darkBase(s, 9); sectionNumber(s, 9);
    eyebrow(s, "DISTRIBUTION");
    title(s, "Go where AI-first builders\nalready share what they ship.", 84, 720, 64, 39);
    body(s, "A founder-led motion that turns public building, directories, hackathons, and student communities into beta conversations.", 64, 228, 630, 80, 17);
    const channels = ["SMOL STARTUP", "PRODUCT HUNT", "DEV COMMUNITY", "LAUNCHKIWI", "TOOL INDEX", "DEVROVE", "AI TOOL DISCOVERY", "VIBERANK", "SIDEPROJECTORS"];
    channels.forEach((c, i) => {
      const col = i % 3, row = Math.floor(i / 3);
      pill(s, c, 64 + col * 280, 356 + row * 58, 250, row === 0 && col === 0 ? "#251735" : C.deep2, row === 0 && col === 0 ? C.white : C.muted, row === 0 && col === 0 ? C.purple : C.line);
    });
    box(s, 930, 240, 246, 324, "#251735", C.purple, 18);
    text(s, "NEXT", 954, 264, 90, 20, 10, C.purple, { bold: true, fontFamily: F.mono });
    text(s, "500", 954, 316, 180, 58, 42, C.white, { bold: true });
    text(s, "beta builders", 954, 370, 180, 28, 16, C.white, { bold: true });
    text(s, "Measure activation:\nselect → understand → save → return.", 954, 430, 180, 90, 13, C.muted);
    note(s, "The go-to-market strategy is community-led and measurable, not paid acquisition dependent.", [
      "/Users/prestonjaysusanto/Unvibe/marketing/src/data/listings.ts",
      "https://smolstartup.com/projects/unvibe",
      "https://www.producthunt.com/products/unvibe?launch=unvibe",
      "https://dev.to/preston_jaysusanto_22498/how-to-review-ai-generated-code-without-losing-ownership-of-your-project-ndl",
    ]);
  }

  // 10 — Execution timeline
  {
    const s = deck.slides.add(); darkBase(s, 10); sectionNumber(s, 10);
    eyebrow(s, "EXECUTION");
    title(s, "Seven weeks from pivot\nto working private beta.", 84, 650, 64, 42);
    s.shapes.add({ geometry: "line", position: { left: 104, top: 402, width: 1010, height: 0 }, fill: "none", line: { style: "solid", fill: C.purple2, width: 3 } });
    const ms = [
      ["11 JUL", "Desktop pivot"],
      ["14 JUL", "unvibe.site live"],
      ["24 JUL", "Private Mac beta"],
      ["27 JUL", "⌘U auto review"],
      ["17 AUG", "Pricing + gifting"],
      ["26 AUG", "#1 daily winner"],
    ];
    ms.forEach((m, i) => {
      const x = 92 + i * 204;
      s.shapes.add({ geometry: "ellipse", position: { left: x, top: 390, width: 24, height: 24 }, fill: i === 5 ? C.orange : C.purple, line: { style: "solid", fill: C.ink, width: 3 } });
      text(s, m[0], x - 12, 430, 110, 22, 9, C.purple, { bold: true, fontFamily: F.mono });
      text(s, m[1], x - 12, 466, 145, 48, 14, C.white, { bold: true });
    });
    box(s, 64, 556, 1110, 64, C.deep2, C.line, 14);
    text(s, "Selection bridge · secret filtering · streaming AI · study loop · usage meters · Google sign-in · durable waitlist", 84, 577, 1070, 24, 13, C.muted, { alignment: "center" });
    note(s, "This is the strongest founder signal: speed with a functioning product and reliability work, not a prototype-only sprint.", [
      "/Users/prestonjaysusanto/Unvibe/marketing/src/data/milestones.ts",
      "Repository git history in /Users/prestonjaysusanto/Unvibe",
      "https://www.docsend.com/blog/seed-round-fundraising-tips-to-make-your-pitch-deck-a-hit-with-vc-investors/",
    ]);
  }

  // 11 — Support / capital efficiency
  {
    const s = deck.slides.add(); darkBase(s, 11); sectionNumber(s, 11);
    eyebrow(s, "CAPITAL EFFICIENCY");
    title(s, "$232.7K in startup support.\nBuilt without a priced round.", 84, 760, 64, 41);
    body(s, "$231.9K is program and platform credit; $800 is founder-reported cash support. Credits are not cash and not investment proceeds.", 64, 224, 720, 74, 16);
    const programs = [
      ["Mixpanel", "$144K"], ["PostHog", "$50K"], ["GitLab", "$23.7K"],
      ["AWS", "$5K"], ["Linear", "$4.5K"], ["Google", "$2K"],
      ["OpenAI", "$1.2K"], ["Deepgram", "$1K"], ["MongoDB", "$500"],
    ];
    programs.forEach((p, i) => {
      const col = i % 3, row = Math.floor(i / 3);
      const x = 64 + col * 270, y = 354 + row * 70;
      text(s, p[0], x, y, 170, 26, 14, C.white, { bold: true });
      text(s, p[1], x + 170, y, 75, 26, 14, i < 3 ? C.purple : C.muted, { bold: true, alignment: "right" });
      s.shapes.add({ geometry: "line", position: { left: x, top: y + 38, width: 245, height: 0 }, fill: "none", line: { style: "solid", fill: C.line, width: 1 } });
    });
    box(s, 900, 346, 276, 214, "#251735", C.purple, 18);
    text(s, "WHAT THIS BUYS", 924, 372, 210, 20, 10, C.purple, { bold: true, fontFamily: F.mono });
    text(s, "Runway for analytics, infra, AI evaluation, and secure developer operations.", 924, 416, 210, 108, 17, C.white, { bold: true });
    note(s, "Be explicit that credits are operating leverage, not fundraising traction.", [
      "/Users/prestonjaysusanto/Unvibe/marketing/src/data/compensation.ts",
      "/Users/prestonjaysusanto/Unvibe/marketing/src/data/milestones.ts",
    ]);
  }

  // 12 — Roadmap + ask
  {
    const s = deck.slides.add(); darkBase(s, 12); sectionNumber(s, 12);
    eyebrow(s, "NEXT 12 MONTHS");
    title(s, "Turn a working loop\ninto a repeatable habit.", 84, 620, 64, 42);
    const plan = [
      ["NOW", "Reliability", "Notarize the Mac app. Harden capture, streaming, and offline recovery."],
      ["NEXT", "Retention", "Weekly review rhythm, stronger concepts, personal notes, visual learning aids."],
      ["THEN", "Distribution", "Open VSX extension, beta communities, referrals, and first paid teams."],
    ];
    plan.forEach((p, i) => {
      const x = 64 + i * 360;
      box(s, x, 308, 330, 230, i === 0 ? "#251735" : C.deep2, i === 0 ? C.purple : C.line, 18);
      text(s, p[0], x + 22, 330, 80, 20, 10, C.purple, { bold: true, fontFamily: F.mono });
      text(s, p[1], x + 22, 376, 260, 34, 21, C.white, { bold: true });
      text(s, p[2], x + 22, 430, 280, 82, 14, C.muted);
    });
    pill(s, "$50K–$100K PRE-SEED / ACCELERATOR SUPPORT", 64, 578, 430, "#251735", C.white, C.purple);
    text(s, "Also seeking introductions to AI-first builders, student developer communities, and design partners.", 532, 584, 620, 34, 13, C.muted);
    note(s, "The ask preserves the range from the original deck while tying it to concrete milestones.", [
      `Prior ask and roadmap: ${path.join(ASSET, "Unvibe_Pitch_Deck.pdf")}`,
      "/Users/prestonjaysusanto/Unvibe/AGENTS.md",
      "https://a16z.com/raising-capital-this-is-the-advice-we-give-our-founders/",
      "https://a16z.com/the-insiders-guide-to-data-rooms-what-to-know-before-you-raise/",
    ]);
  }

  // 13 — Founder / close
  {
    const s = deck.slides.add(); darkBase(s, 13, "UNVIBE · PRESTON@UNVIBE.SITE"); sectionNumber(s, 13);
    eyebrow(s, "FOUNDER");
    title(s, "Built by someone\ninside the problem.", 92, 600, 64, 42);
    body(s, "Preston Susanto is a solo technical founder building Unvibe while using AI coding tools every day—and feeling the ownership gap firsthand.", 64, 244, 540, 96, 18);
    const bullets = [
      "Product, desktop, backend, and launch motion built end-to-end",
      "Rapid user-feedback loop with public build records",
      "Google Developers Group DVC founder and hackathon organizer",
      "Mission: make AI development understandable, verifiable, and retainable",
    ];
    bullets.forEach((b, i) => {
      text(s, "◆", 66, 386 + i * 46, 18, 20, 10, C.purple, { alignment: "center" });
      text(s, b, 96, 382 + i * 46, 500, 34, 14, C.white);
    });
    box(s, 700, 116, 480, 476, "#251735", C.purple, 24);
    await image(s, LOGO, 878, 164, 124, 124, { fit: "contain", radius: 20, alt: "Unvibe logo" });
    text(s, "Make AI development\nunderstandable.", 754, 336, 372, 90, 31, C.white, { bold: true, alignment: "center" });
    text(s, "unvibe.site", 754, 476, 372, 28, 15, C.purple, { bold: true, fontFamily: F.mono, alignment: "center" });
    text(s, "preston@unvibe.site", 754, 522, 372, 24, 12, C.muted, { alignment: "center" });
    note(s, "Close on founder-market fit and the category ambition.", [
      `Founder biography adapted from ${path.join(ASSET, "Unvibe_Pitch_Deck.pdf")}`,
      `Brand asset: ${LOGO}`,
      "https://unvibe.site",
      "https://www.ycombinator.com/blog/aaron-harris-on-fundraising-and-meeting-with-investors",
    ]);
  }

  for (const [i, slide] of deck.slides.items.entries()) {
    const stem = `slide-${String(i + 1).padStart(2, "0")}`;
    const png = await deck.export({ slide, format: "png", scale: 1 });
    await fs.writeFile(path.join(TMP, `${stem}.png`), new Uint8Array(await png.arrayBuffer()));
    const layout = await slide.export({ format: "layout" });
    await fs.writeFile(path.join(TMP, `${stem}.layout.json`), await layout.text());
  }
  const montage = await deck.export({ format: "webp", montage: true, scale: 0.75 });
  await fs.writeFile(path.join(TMP, "deck-montage.webp"), new Uint8Array(await montage.arrayBuffer()));
  const pptx = await PresentationFile.exportPptx(deck);
  await pptx.save(path.join(OUT, "Unvibe_Investor_Deck_Professional_August_2026.pptx"));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
