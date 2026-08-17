export type MilestoneCategory = "PRODUCT" | "INFRA" | "COMPANY" | "DISTRIBUTION";

export interface Milestone {
  date: string;
  category: MilestoneCategory;
  title: string;
  summary: string;
  figure?: string;
  pinned?: boolean;
}

export const milestones: Milestone[] = [
  {
    date: "16 AUG 2026",
    category: "COMPANY",
    title: "GitLab for Startups",
    summary: "Accepted into the program. GitLab Ultimate credits to secure, automate, and scale the developer pipeline. Not cash. Not a round.",
    figure: "$23,700",
    pinned: true,
  },
  {
    date: "17 AUG 2026",
    category: "DISTRIBUTION",
    title: "Gift Unvibe",
    summary: "Share an 8 character SPECIAL CHAR from the Mac app. A friend joins the waitlist with your email and that code. Both of you get 1 month of Pro, up to five gifts.",
    figure: "5 gifts",
  },
  {
    date: "17 AUG 2026",
    category: "PRODUCT",
    title: "Almost here",
    summary: "Live testing is done. Feedback is done. Unvibe is at 75 percent to public release.",
    figure: "75%",
  },
  {
    date: "3 AUG 2026",
    category: "INFRA",
    title: "Waitlist attribution scorecard",
    summary: "Founder analytics now show where waitlist signups came from. Pushed as the attribution scorecard commit.",
  },
  {
    date: "30 JUL 2026",
    category: "PRODUCT",
    title: "Private beta 0.1.10",
    summary: "AI usage and selected-code usage are tracked separately, with remaining credits in the widget. Pushed as v0.1.10-beta-usage.",
  },
  {
    date: "29 JUL 2026",
    category: "PRODUCT",
    title: "Build in public",
    summary: "A live founder signal, public roadmap, and a compact development record went live on /build.",
  },
  {
    date: "28 JUL 2026",
    category: "DISTRIBUTION",
    title: "Official demo video",
    summary: "The homepage demo now plays the latest official product video. Pushed from the demo-video integration.",
  },
  {
    date: "28 JUL 2026",
    category: "INFRA",
    title: "Selection bridge and production API",
    summary: "The Command U capture path, service connection, durable waitlist, and beta demo were hardened.",
  },
  {
    date: "27 JUL 2026",
    category: "PRODUCT",
    title: "0.1.4 feedback and rewards",
    summary: "Beta feedback can be sent from the desktop app with version and screen context filled in. Referral progress is on /rewards. Pushed as v0.1.4-feedback-rewards.",
  },
  {
    date: "27 JUL 2026",
    category: "PRODUCT",
    title: "0.1.3 Command U auto reviews",
    summary: "Select code in VS Code or Cursor, press Command U, and Unvibe opens an explanation. Panels scale on resize and dim when idle. Pushed as v0.1.3-cmdu-auto.",
  },
  {
    date: "27 JUL 2026",
    category: "DISTRIBUTION",
    title: "Private-beta feedback loop",
    summary: "Tester feedback, referral rewards, listing badges, and release communication went live.",
  },
  {
    date: "24 JUL 2026",
    category: "PRODUCT",
    title: "0.1.2 private beta",
    summary: "Full-product demo mode, Google device sign-in, and optional Accessibility for selected-code capture. Pushed as v0.1.2-google-auth.",
  },
  {
    date: "24 JUL 2026",
    category: "PRODUCT",
    title: "Selected-code capture on Mac",
    summary: "Command U capture was made reliable on macOS, then an unlimited full-product desktop build was pushed.",
  },
  {
    date: "23 JUL 2026",
    category: "PRODUCT",
    title: "Island on the camera bar",
    summary: "The Island sits in the MacBook camera area, expands into a live learning dashboard, and morphs between compact modes.",
  },
  {
    date: "23 JUL 2026",
    category: "COMPANY",
    title: "Google AI Startups",
    summary: "Accepted into Google AI Startups. $2,000 in Google Cloud credits, USD.",
    figure: "$2,000",
  },
  {
    date: "22 JUL 2026",
    category: "PRODUCT",
    title: "Native installer and Island",
    summary: "The Mac installer, desktop Island, learning surfaces, and referral beta flow shipped together.",
  },
  {
    date: "21 JUL 2026",
    category: "COMPANY",
    title: "MongoDB for Startups",
    summary: "Joined MongoDB for Startups as a program member. $500 in startup support.",
    figure: "$500",
  },
  {
    date: "20 JUL 2026",
    category: "COMPANY",
    title: "Investor outreach began",
    summary: "The first investor materials and founder outreach moved Unvibe beyond a private product experiment.",
  },
  {
    date: "16 JUL 2026",
    category: "INFRA",
    title: "Beta infrastructure",
    summary: "Waitlist, pricing, production routes, download delivery, and a real launch surface came online.",
  },
  {
    date: "14 JUL 2026",
    category: "DISTRIBUTION",
    title: "unvibe.site went live",
    summary: "The product received a public home, production domain, and the first developer-facing story. Desktop installers were pushed as v1.0.0.",
  },
  {
    date: "11 JUL 2026",
    category: "PRODUCT",
    title: "Desktop-first pivot",
    summary: "Unvibe became a Mac desktop learning layer built around selection, explanation, recall, and progress.",
  },
];

export function changelogEntries(): Milestone[] {
  const pinned = milestones.filter((item) => item.pinned);
  const rest = milestones.filter((item) => !item.pinned);
  return [...pinned, ...rest];
}

export function changelogPreview(limit = 5): Milestone[] {
  return changelogEntries().slice(0, limit);
}
