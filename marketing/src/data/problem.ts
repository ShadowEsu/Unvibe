/**
 * The problem Unvibe answers, from the founder's note "Nobody Read the Code: Why I'm Building Unvibe" (Sat 7 Nov 2026).
 * Every figure here is one the note prints, with the note's own hedges. A source with an href was checked against the
 * public original (8 Nov); one without is attributed by name only, as the note does. Never add a number the note
 * doesn't have: problem.test.ts pins the display values.
 */

export type Source = { readonly name: string; readonly href?: string };

export type ProblemStat = {
  readonly value: number;
  readonly decimals?: number;
  readonly prefix?: string;
  readonly suffix?: string;
  readonly label: string;
  readonly detail: string;
  readonly sources: readonly Source[];
};

export type Verdict = "direct" | "partial" | "out";

export type Incident = {
  readonly when: string;
  readonly who: string;
  readonly what: string;
  readonly damage: string;
  readonly rootCause: string;
  readonly verdict: Verdict;
  readonly verdictNote?: string;
  readonly sources: readonly Source[];
};

export type Finding = { readonly finding: string; readonly number: string; readonly sources: readonly Source[] };

export const PROBLEM_NOTE = {
  kicker: "Unvibe · Founder's note",
  date: "Saturday, November 7, 2026",
  dateTime: "2026-11-07",
  title: "Nobody Read the Code",
  subtitle: "Why I'm Building Unvibe",
  standfirst:
    "Vibe coding didn't fail because AI writes bad code. It failed because people shipped code they never read. I went through 20 months of public incidents, lawsuits and research, from a SaaS app shut down in a week to Amazon's checkout going dark for six hours. The same root cause keeps coming up: code reached production and nobody understood it. That is the gap I'm building Unvibe to close.",
} as const;

export const PROBLEM_STATS: readonly ProblemStat[] = [
  {
    value: 45,
    suffix: "%",
    label: "AI code samples failing security tests",
    detail: "Across 100+ models",
    sources: [{ name: "Veracode", href: "https://www.veracode.com/blog/genai-code-security-report/" }],
  },
  {
    value: 5000,
    suffix: "+",
    label: "Vibe-coded apps with no real auth",
    detail: "~40% leaked sensitive data",
    sources: [{ name: "RedAccess, via WIRED", href: "https://www.wired.com/story/thousands-of-vibe-coded-apps-expose-corporate-and-personal-data-on-the-open-web/" }],
  },
  {
    value: 75,
    suffix: "%",
    label: "Google's new code that is AI-generated",
    detail: "Up from ~25% in Oct 2024",
    sources: [{ name: "Google, via Business Insider", href: "https://www.businessinsider.com/google-ai-generated-code-75-gemini-agents-software-2026-4" }],
  },
  {
    value: 4.99,
    decimals: 2,
    prefix: "$",
    suffix: "M",
    label: "Average cost of a data breach",
    detail: "A record high",
    sources: [{ name: "IBM, Cost of a Data Breach 2026", href: "https://www.ibm.com/reports/data-breach" }],
  },
];

/** A stat as the note prints it, at `n` while it counts up, or at its value. */
export function formatStat(stat: ProblemStat, n: number): string {
  const digits = stat.decimals ?? 0;
  const number = n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  return `${stat.prefix ?? ""}${number}${stat.suffix ?? ""}`;
}

export const INCIDENTS: readonly Incident[] = [
  {
    when: "Mar 2025",
    who: "EnrichLead",
    what: "Founder bragged about \u201Czero hand-written code\u201D built with Cursor. Within days, attackers found API keys in the client code and got past a paywall built in CSS.",
    damage: "App shut down within a week",
    rootCause: "Keys in client code; paywall in CSS",
    verdict: "direct",
    sources: [{ name: "Leo Acevedo on X, via Pivot to AI", href: "https://pivot-to-ai.com/2025/03/18/guys-im-under-attack-ai-vibe-coding-in-the-wild/" }],
  },
  {
    when: "2025",
    who: "170+ Lovable apps",
    what: "CVE-2025-48757: row-level security missing on Supabase, so anyone holding the public key could read the database.",
    damage: "Databases readable",
    rootCause: "Row-level security never turned on",
    verdict: "direct",
    sources: [{ name: "GitHub Advisory Database", href: "https://github.com/advisories/GHSA-773x-pxjg-gxgx" }],
  },
  {
    when: "Jul 2025",
    who: "Replit \u00D7 SaaStr",
    what: "The agent wiped a live database during a declared code freeze, then wrongly said rollback was impossible.",
    damage: "Records for 1,200+ execs and 1,190+ companies",
    rootCause: "Agent with production access",
    verdict: "partial",
    verdictNote: "needs permissions",
    sources: [{ name: "Fast Company", href: "https://www.fastcompany.com/91372483/replit-ceo-what-really-happened-when-ai-agent-wiped-jason-lemkins-database-exclusive" }],
  },
  {
    when: "Jul 2025",
    who: "Tea app",
    what: "Unsecured cloud storage exposed selfies and government IDs. Lawyers allege the app was vibe coded.",
    damage: "72K images, 1M+ messages, class actions",
    rootCause: "Unsecured legacy storage",
    verdict: "partial",
    sources: [{ name: "NBC News", href: "https://www.nbcnews.com/tech/social-media/10-women-sued-tea-app-photos-hacked-leaked-online-rcna222880" }],
  },
  {
    when: "Jul 2025",
    who: "Base44 (Wix)",
    what: "Anyone with a public app_id could register on private enterprise apps, getting around SSO.",
    damage: "Patched; no abuse found",
    rootCause: "Vendor's own auth bug",
    verdict: "out",
    sources: [{ name: "Wiz Research", href: "https://www.wiz.io/blog/critical-vulnerability-base44" }],
  },
  {
    when: "Jul 2025",
    who: "Amazon Q",
    what: "A malicious pull request planted a \u201Cwipe the system\u201D prompt in the official VS Code extension.",
    damage: "~964K installs exposed",
    rootCause: "Supply-chain attack",
    verdict: "out",
    sources: [
      { name: "AWS security bulletin", href: "https://aws.amazon.com/security/security-bulletins/AWS-2025-015/" },
      { name: "SC Media", href: "https://www.scworld.com/news/amazon-q-extension-for-vs-code-reportedly-injected-with-wiper-prompt" },
    ],
  },
  {
    when: "Early 2026",
    who: "Moltbook",
    what: "A misconfigured Supabase backend gave anyone full read and write access to the database.",
    damage: "1.5M API tokens, 35K emails",
    rootCause: "Database open to public read and write",
    verdict: "direct",
    sources: [{ name: "Wiz Research", href: "https://www.wiz.io/blog/exposed-moltbook-database-reveals-millions-of-api-keys" }],
  },
  {
    when: "Feb 2026",
    who: "App hosted on Lovable",
    what: "16 flaws, six critical, including AI-written auth logic that looked right but wasn't.",
    damage: "18,697 records, including K-12 users",
    rootCause: "Auth logic that looked right but wasn't",
    verdict: "direct",
    sources: [{ name: "The Register", href: "https://www.theregister.com/software/2026/02/27/ai-built-app-on-lovable-exposed-18k-users-researcher-claims/5038511" }],
  },
  {
    when: "Mar 2026",
    who: "Amazon retail",
    what: "Four Sev-1s in one week. An internal note blamed \u201CGenAI-assisted changes,\u201D a line later deleted. Amazon says one incident involved bad AI advice and none involved AI-written code.",
    damage: "~6-hour checkout outage",
    rootCause: "Engineer followed inaccurate AI advice",
    verdict: "partial",
    sources: [
      { name: "CNBC", href: "https://www.cnbc.com/2026/03/10/amazon-plans-deep-dive-internal-meeting-address-ai-related-outages.html" },
      { name: "Amazon's response", href: "https://www.aboutamazon.com/news/company-news/amazon-outage-ai-financial-times-correction" },
    ],
  },
  {
    when: "Apr 2026",
    who: "Lovable platform",
    what: "A broken object-level authorization bug let any free account read other users' code, chats and database credentials. The report went unfixed for 48 days.",
    damage: "Projects created before Nov 2025",
    rootCause: "Vendor's own API bug",
    verdict: "out",
    sources: [{ name: "The Register", href: "https://www.theregister.com/security/2026/04/21/lovable-denies-data-leak-cites-intentional-behavior/5226233" }],
  },
  {
    when: "Apr 2026",
    who: "PocketOS",
    what: "A Cursor agent on Claude Opus 4.6 deleted the production database and its backups in nine seconds, against explicit rules.",
    damage: "3 months of reservations; 2+ days down",
    rootCause: "Agent with production access",
    verdict: "partial",
    verdictNote: "needs permissions",
    sources: [{ name: "The Guardian", href: "https://www.theguardian.com/technology/2026/apr/29/claude-ai-deletes-firm-database" }],
  },
  {
    when: "Jul\u2013Sep 2026",
    who: "Grok Build, Z.ai",
    what: "Coding CLIs uploaded whole repositories, git history included, to vendor storage. Opt-outs didn't stop it.",
    damage: "5.1 GiB from one test repo",
    rootCause: "Tools uploading repos",
    verdict: "out",
    verdictNote: "design lesson",
    sources: [{ name: "The Hacker News (Grok Build)", href: "https://thehackernews.com/2026/07/grok-build-uploads-entire-git.html" }],
  },
  {
    when: "Aug 2026",
    who: "METR",
    what: "The login on a vibe-coded internal dashboard failed open. An attacker pulled out an API key and kept access for three weeks.",
    damage: "~$600K in AI credits",
    rootCause: "Login failed open",
    verdict: "direct",
    sources: [{ name: "METR", href: "https://metr.org/blog/2026-08-31-security-update/" }],
  },
  {
    when: "Oct 2026",
    who: "Bootlegger Coffee",
    what: "A legacy dashboard, reportedly built with Claude, sent franchisee data in its page source. The company disputes that customer data was involved.",
    damage: "132 locations' data",
    rootCause: "Data sent in page source",
    verdict: "direct",
    sources: [{ name: "MyBroadband", href: "https://mybroadband.co.za/news/security/672647-ceo-of-top-south-african-coffee-franchise-responds-after-vibe-coded-web-application-exposed-sensitive-data.html" }],
  },
];

export const INCIDENT_QUOTE = {
  text: "You guys were right, I shouldn't have deployed unsecured code to production.",
  by: "Leo Acevedo, shutting down EnrichLead, March 20, 2025",
} as const;

export const VERDICTS: Readonly<Record<Verdict, { readonly label: string; readonly meaning: string }>> = {
  direct: { label: "Direct", meaning: "A builder who read and understood the code would have caught the flaw before launch." },
  partial: { label: "Partial", meaning: "Understanding would have helped but wasn't enough on its own." },
  out: { label: "Out of scope", meaning: "Platform or supply-chain failures that no builder could have fixed." },
};

export const VERDICT_ORDER: readonly Verdict[] = ["direct", "partial", "out"];

/** How many incidents got each verdict (the note's 6·4·4). */
export function verdictCounts(incidents: readonly Incident[] = INCIDENTS): Record<Verdict, number> {
  const counts: Record<Verdict, number> = { direct: 0, partial: 0, out: 0 };
  for (const incident of incidents) counts[incident.verdict] += 1;
  return counts;
}

export const GOOGLE_SHARE = {
  title: "The share keeps climbing",
  body: "Google's AI-generated share of new code has tripled in 18 months. Google says engineers still review it, and some engineers now have AI-usage goals in their performance reviews.",
  caption: "Fig. 1 \u2014 Share of Google's new code generated by AI",
  bars: [
    { label: "Oct 2024", value: 25, display: "~25%" },
    { label: "2026", value: 75, display: "75%" },
  ],
  sources: [{ name: "Google, via Business Insider", href: "https://www.businessinsider.com/google-ai-generated-code-75-gemini-agents-software-2026-4" }],
} as const;

export const MANDATES = {
  title: "Mandates outpace review",
  lead: "Every giant is pushing in the same direction. Each one now has more AI-written code than its people can read.",
  items: [
    { who: "Microsoft", text: "Satya Nadella said 20\u201330% of code in some projects is written by AI." },
    { who: "Meta", text: "Some orgs set a goal of 55% \u201Cagent-assisted\u201D changes, and one org expects 75%+ AI-written commits." },
    { who: "Snap", text: "At least 65% of new code is AI-generated." },
    { who: "Amazon", text: "After its retail outages, a director said \u201Cevery mutating step that an AI might do requires a human to approve it.\u201D" },
    { who: "OpenAI", text: "Two of its own coding agents turned off monitoring alerts during routine work, and one denied doing it." },
  ],
} as const;

export const COURTS = {
  title: "Where the courts are",
  body: "No court has yet ruled on \u201Cvibe coding\u201D as a legal theory. The lawsuits are about what it leaks. Tea is the biggest test case. Federal class actions were consolidated as In re Tea Dating Advice Data Breach Litigation (N.D. Cal., No. 25-cv-06321), with more than 25 named plaintiffs. Separate suits in Illinois are filed under its biometric privacy law.",
  exposure: [
    { figure: "$100\u2013$750", text: "California consumer privacy law: per consumer, per breach, with no proof of harm required." },
    { figure: "$5,000", text: "California's wiretapping law (CIPA): per violation for tracking scripts. This is the demand letter small apps are most likely to get." },
    { figure: "$3.85M", text: "The LA Times settled a CIPA tracker claim in June 2026." },
  ],
} as const;

export const VALUATIONS = {
  title: "Valuations on shaky code",
  body: "Lovable claims a $6.6B valuation, and Uber, Zendesk and Deutsche Telekom use it. Its first public response to the April leak was that it \u201Cdid not suffer a data breach.\u201D It then blamed unclear documentation, and then its bug-bounty partner. Lovable, Replit and Base44 all told WIRED the same thing: security configuration is the builder's job. If the platform won't own your security, you have to understand it yourself.",
  sources: [{ name: "The Register (Lovable's response)", href: "https://www.theregister.com/security/2026/04/21/lovable-denies-data-leak-cites-intentional-behavior/5226233" }, { name: "WIRED" }],
} as const;

export const RESEARCH: readonly Finding[] = [
  { finding: "AI code samples failing basic security checks", number: "45%", sources: [{ name: "Veracode", href: "https://www.veracode.com/blog/genai-code-security-report/" }] },
  { finding: "Issues in AI pull requests vs. human ones", number: "~1.7\u00D7", sources: [{ name: "CodeRabbit", href: "https://www.coderabbit.ai/blog/state-of-ai-vs-human-code-generation-report" }] },
  { finding: "Experienced developers' speed with AI tools", number: "19% slower", sources: [{ name: "METR", href: "https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/" }] },
  { finding: "CVEs tied to AI code, Jan \u2192 Mar 2026", number: "6 \u2192 35", sources: [{ name: "Georgia Tech", href: "https://www.cc.gatech.edu/news/bad-vibes-ai-generated-code-vulnerable-researchers-warn" }] },
  { finding: "Developers who distrust AI accuracy vs. trust it", number: "46% vs. 33%", sources: [{ name: "Stack Overflow", href: "https://survey.stackoverflow.co/2025/ai" }] },
  { finding: "Developers frustrated by \u201Calmost right\u201D AI output", number: "66%", sources: [{ name: "Stack Overflow", href: "https://survey.stackoverflow.co/2025/ai" }] },
];

export const RESEARCH_TAKEAWAY = "\u201CAlmost right\u201D is the dangerous part. Code that fails loudly gets fixed. Code that looks right ships.";

export const EVALUATION_LEAD =
  "I scored every incident in the ledger honestly, including the ones Unvibe can't help with. In six, a builder who read and understood the code would have caught the flaw before launch. In four, understanding would have helped but wasn't enough on its own. Four were platform or supply-chain failures that no builder could have fixed.";

export const THESIS = [
  "AI made writing code free. Understanding it is still expensive, and that is where the damage happens. The industry's answer is more AI to review the AI. Mine is simpler: the person who ships the code should understand it. Not every line forever. Just the parts that touch keys, auth, data and money.",
] as const;

/** The note says Control+U; Windows readers see their own shortcut (the site's OS-aware copy). */
export const PITCH = {
  before: "Unvibe is a free desktop app for Mac and Windows. Select code in any app, whether that's Cursor, VS Code, Xcode or Terminal, and press ",
  shortcut: { mac: "Control+U", windows: "Ctrl+Alt+U" },
  after: ". It explains the code beside your editor at your level, from New to Advanced. Then Test me asks up to three questions so you know you actually understood it.",
} as const;

export const MAPPED = [
  { failure: "Keys in client code", cases: "EnrichLead, METR", answer: "Unvibe scans for keys and tokens on your machine and stops a known key before anything is sent." },
  { failure: "Auth that looks right", cases: "Lovable app, Moltbook", answer: "Ask \u201CWhat breaks if I remove it?\u201D before you ship the code." },
  { failure: "Agents changing things nobody reviewed", cases: "Amazon, PocketOS", answer: "Briefs turn your git changes into a plain-English summary of what to review first." },
  { failure: "Tools uploading your repo", cases: "Grok Build, Z.ai", answer: "Unvibe never uploads your repo and never changes your code." },
] as const;

export const WONT_DO =
  "Unvibe is not a security scanner, a firewall or a permission system. It won't stop an agent that has production credentials, and it won't patch your vendor's bugs. Its explanations can be wrong, which is why they sit next to the code so you can check them. What it does is make sure the code you ship is code you understand.";
