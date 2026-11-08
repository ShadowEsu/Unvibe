import type { Metadata } from "next";
import { Fragment, type ReactNode } from "react";
import Link from "next/link";
import { KEY_CHECK_SHOT, SHOT_CAPTION } from "@/data/homeGallery";
import { pageMetadata } from "@/lib/pageMeta";
import { SHORTCUTS } from "@/lib/shortcuts";
import "./why.css";

const { mac, windows } = SHORTCUTS;

export const metadata: Metadata = pageMetadata({
  path: "/why",
  title: "Nobody read the code: why we built Unvibe",
  absolute: true,
  description: "14 public incidents from Mar 2025 to Oct 2026, the research behind them, and which ones understanding the code would have stopped.",
});

/**
 * The "Nobody read the code" page (ledger 579): the report behind Unvibe, in product voice (Security F-1 ruling,
 * requests/security/20261107-1738). Every figure and incident was re-sourced on 7 Nov 2026 from its primary source;
 * the URL and exact quote for each are in boss-handoff agents/unvibe-content/why-page/SOURCES.md. Disputed accounts
 * keep the company's own position in the same row.
 */
const SOURCES = [
  { id: "google-2026", title: "Cloud Next '26: Momentum and innovation at Google scale", by: "Sundar Pichai, Google", date: "22 Apr 2026", url: "https://blog.google/innovation-and-ai/infrastructure-and-cloud/google-cloud/cloud-next-2026-sundar-pichai/" },
  { id: "google-2024", title: "Alphabet Q3 earnings call: CEO Sundar Pichai's remarks", by: "Google", date: "29 Oct 2024", url: "https://blog.google/company-news/inside-google/message-ceo/alphabet-earnings-q3-2024/" },
  { id: "veracode-2026", title: "Veracode finds first meaningful gain in AI code security since 2025 as average pass rate hits 62%", by: "Veracode", date: "29 Oct 2026", url: "https://www.veracode.com/press-release/veracode-finds-first-meaningful-gain-in-ai-code-security-since-2025-as-average-pass-rate-hits-62/" },
  { id: "ibm-2026", title: "Cost of a Data Breach Report 2026", by: "IBM and Ponemon Institute", date: "Jul 2026", url: "https://www-api.ibm.com/adobe/assets/urn:aaid:aem:21111142-1251-4369-86fb-57b82f5bb108/original/as/Cost-of-a-Data-Breach-Report-2026.pdf" },
  { id: "infosec-gatech", title: "Security researchers sound the alarm on vulnerabilities in AI-generated code", by: "Infosecurity Magazine", date: "26 Mar 2026", url: "https://www.infosecurity-magazine.com/news/ai-generated-code-vulnerabilities/" },
  { id: "gatech", title: "Bad vibes: AI-generated code is vulnerable, researchers warn", by: "Georgia Tech Research News", date: "13 Apr 2026", url: "https://news.research.gatech.edu/2026/04/13/bad-vibes-ai-generated-code-vulnerable-researchers-warn" },
  { id: "leo-boast", title: "\"my saas was built with Cursor, zero hand written code\"", by: "the app's founder, on X", date: "15 Mar 2025", url: "https://x.com/leojr94_/status/1900767509621674109" },
  { id: "leo-attack", title: "\"guys, i'm under attack\"", by: "the app's founder, on X", date: "17 Mar 2025", url: "https://x.com/leojr94_/status/1901560276488511759" },
  { id: "leo-fix", title: "\"rolled all api keys and moved them to environment variables\"", by: "the app's founder, on X", date: "17 Mar 2025", url: "https://x.com/leojr94_/status/1901598955508494573" },
  { id: "pivot", title: "'Guys, I'm under attack': AI 'vibe coding' in the wild", by: "Pivot to AI", date: "18 Mar 2025", url: "https://pivot-to-ai.com/2025/03/18/guys-im-under-attack-ai-vibe-coding-in-the-wild/" },
  { id: "leo-shutdown", title: "\"i'm shutting down my app\"", by: "the app's founder, on X", date: "20 Mar 2025", url: "https://x.com/leojr94_/status/1902537756674318347" },
  { id: "palmer", title: "Statement on CVE-2025-48757", by: "Matt Palmer", date: "29 May 2025", url: "https://mattpalmer.io/posts/2025/05/statement-on-CVE-2025-48757/" },
  { id: "cve", title: "CVE-2025-48757", by: "CVE Program (MITRE)", date: "30 May 2025", url: "https://www.cve.org/CVERecord?id=CVE-2025-48757" },
  { id: "lemkin-delete", title: "\"@Replit goes rogue during a code freeze and shutdown and deletes our entire database\"", by: "Jason Lemkin, on X", date: "18 Jul 2025", url: "https://x.com/jasonlk/status/1946069562723897802" },
  { id: "lemkin-rollback", title: "\"It turns out Replit was wrong, and the rollback did work\"", by: "Jason Lemkin, on X", date: "18 Jul 2025", url: "https://x.com/jasonlk/status/1946240562736365809" },
  { id: "masad", title: "\"We saw Jason's post\"", by: "Amjad Masad, Replit CEO, on X", date: "20 Jul 2025", url: "https://x.com/amasad/status/1946986468586721478" },
  { id: "tea-statement", title: "Official statement (archived copy)", by: "Tea Dating Advice, Inc.", date: "26 Jul 2025", url: "https://web.archive.org/web/20250726055554/https://www.teaforwomen.com/cyberincident" },
  { id: "tea-dms", title: "Tea app's data breach gets much worse, exposing over a million private messages", by: "TechCrunch", date: "29 Jul 2025", url: "https://techcrunch.com/2025/07/29/tea-apps-data-breach-gets-much-worse-exposing-over-a-million-private-messages/" },
  { id: "tea-docket", title: "Docket, In re Tea Dating Advice Data Breach Litigation, No. 3:25-cv-06321 (N.D. Cal.), order granting consolidation", by: "CourtListener", date: "9 Sep 2025", url: "https://www.courtlistener.com/docket/70946885/in-re-tea-dating-advice-data-breach-litigation/" },
  { id: "tea-complaint", title: "Consolidated Class Action Complaint, In re Tea Dating Advice Data Breach Litigation, No. 3:25-cv-06321 (N.D. Cal.), ECF 79", by: "CourtListener", date: "23 Dec 2025", url: "https://www.courtlistener.com/docket/70946885/79/in-re-tea-dating-advice-data-breach-litigation/" },
  { id: "tea-settle", title: "Stipulation and order staying all deadlines, ECF 106 (settlement in principle)", by: "CourtListener", date: "30 Jun 2026", url: "https://www.courtlistener.com/docket/70946885/106/in-re-tea-dating-advice-data-breach-litigation/" },
  { id: "wiz-base44", title: "Wiz Research uncovers critical vulnerability in AI vibe coding platform Base44", by: "Wiz", date: "29 Jul 2025", url: "https://www.wiz.io/blog/critical-vulnerability-base44" },
  { id: "404-q", title: "Hacker plants computer 'wiping' commands in Amazon's AI coding agent", by: "404 Media", date: "23 Jul 2025", url: "https://www.404media.co/hacker-plants-computer-wiping-commands-in-amazons-ai-coding-agent/" },
  { id: "aws-q", title: "Security update for Amazon Q Developer extension for Visual Studio Code (version 1.84), AWS-2025-015", by: "AWS", date: "23 Jul 2025", url: "https://aws.amazon.com/security/security-bulletins/AWS-2025-015/" },
  { id: "wiz-moltbook", title: "Hacking Moltbook: the AI social network any human can control", by: "Wiz", date: "2 Feb 2026", url: "https://www.wiz.io/blog/exposed-moltbook-database-reveals-millions-of-api-keys" },
  { id: "khan", title: "Lovable? More like hackable.", by: "Taimur Khan, on LinkedIn", date: "26 Feb 2026", url: "https://www.linkedin.com/pulse/lovable-more-like-hackable-taimur-khan-cewdf/" },
  { id: "reg-lovable-app", title: "Lovable-hosted app littered with basic flaws exposed 18K users, researcher claims", by: "The Register", date: "27 Feb 2026", url: "https://www.theregister.com/software/2026/02/27/ai-built-app-on-lovable-exposed-18k-users-researcher-claims/5038511" },
  { id: "cnbc-amazon", title: "Amazon convenes 'deep dive' internal meeting to address outages", by: "CNBC", date: "10 Mar 2026", url: "https://www.cnbc.com/2026/03/10/amazon-plans-deep-dive-internal-meeting-address-ai-related-outages.html" },
  { id: "amazon-statement", title: "Correcting the Financial Times report about recent Amazon.com service incidents and AI", by: "Amazon", date: "12 Mar 2026", url: "https://www.aboutamazon.com/news/company-news/amazon-outage-ai-financial-times-correction" },
  { id: "bi-amazon", title: "Amazon orders 90-day reset after code mishaps cause millions of lost orders", by: "Business Insider", date: "10 Mar 2026", url: "https://www.businessinsider.com/amazon-tightens-code-controls-after-outages-including-one-ai-2026-3" },
  { id: "metr-security", title: "Update on security at METR", by: "METR", date: "31 Aug 2026", url: "https://metr.org/blog/2026-08-31-security-update/" },
  { id: "reg-lovable-bola", title: "Vibe coding upstart Lovable denies data leak, cites 'intentional behavior,' then throws HackerOne under the bus", by: "The Register", date: "21 Apr 2026", url: "https://www.theregister.com/security/2026/04/21/lovable-denies-data-leak-cites-intentional-behavior/5226233" },
  { id: "lovable-response", title: "Our response to the April 2026 incident", by: "Lovable", date: "22 Apr 2026", url: "https://lovable.dev/blog/our-response-to-the-april-2026-incident" },
  { id: "crane", title: "An AI agent just destroyed our production data. It confessed in writing.", by: "Jer Crane, PocketOS, on X", date: "25 Apr 2026", url: "https://x.com/lifeof_jer/status/2048103471019434248" },
  { id: "reg-pocketos", title: "Cursor-Opus agent snuffs out startup's production database", by: "The Register", date: "27 Apr 2026", url: "https://www.theregister.com/software/2026/04/27/cursor-opus-agent-snuffs-out-startups-production-database/5224442" },
  { id: "cereblab", title: "Wire-level analysis of xAI's Grok Build CLI (archived copy)", by: "cereblab", date: "Jul 2026", url: "http://web.archive.org/web/20261004073959/https://gist.github.com/cereblab/dc9a40bc26120f4540e4e09b75ffb547" },
  { id: "thn-grok", title: "Grok Build uploaded entire Git repositories to xAI storage, not just files it read", by: "The Hacker News", date: "14 Jul 2026", url: "https://thehackernews.com/2026/07/grok-build-uploads-entire-git.html" },
  { id: "ferstar", title: "Inside ZCode: silently uploading your entire Git history to the cloud", by: "ferstar", date: "18 Sep 2026", url: "https://blog.ferstar.org/en/posts/zcode-silent-workspace-snapshot-upload/" },
  { id: "mybroadband", title: "South African coffee franchise exposes company and private data in vibe-coded web application (archived copy)", by: "MyBroadband", date: "16 Oct 2026", url: "https://web.archive.org/web/20261025065959/https://mybroadband.co.za/news/software/672602-south-african-coffee-franchise-exposes-company-and-private-data-in-vibe-coded-web-application.html" },
  { id: "itweb", title: "Bootlegger CEO's AI enthusiasm meets reality", by: "ITWeb", date: "20 Oct 2026", url: "https://www.itweb.co.za/article/bootlegger-ceos-ai-enthusiasm-meets-reality/Gb3Bw7Wa9kPq2k6V" },
  { id: "bi-google", title: "Google says 75% of the company's new code is AI-generated", by: "Business Insider", date: "22 Apr 2026", url: "https://www.businessinsider.com/google-ai-generated-code-75-gemini-agents-software-2026-4" },
  { id: "cnbc-nadella", title: "Satya Nadella says as much as 30% of Microsoft code is written by AI", by: "CNBC", date: "29 Apr 2025", url: "https://www.cnbc.com/2025/04/29/satya-nadella-says-as-much-as-30percent-of-microsoft-code-is-written-by-ai.html" },
  { id: "bi-meta", title: "Meta is pushing employees to use AI, and this doc shows how much", by: "Business Insider", date: "26 Mar 2026", url: "https://www.businessinsider.com/meta-ai-push-employee-goals-tool-adoption-2-026-3" },
  { id: "snap", title: "Snap Inc. Form 8-K, Exhibit 99.2, investor update", by: "SEC EDGAR", date: "15 Apr 2026", url: "https://www.sec.gov/Archives/edgar/data/1564408/000119312526155861/d36756dex992.htm" },
  { id: "reg-amazon-review", title: "AWS keynote hypes AI as magic. Its own engineers tell a different story", by: "The Register", date: "29 Apr 2026", url: "https://www.theregister.com/software/2026/04/29/amazon-tells-its-engineers-to-review-all-ai-output/5224124" },
  { id: "openai", title: "Suppressing misalignment monitoring alerts and disabling misalignment monitoring", by: "OpenAI Alignment", date: "20 Oct 2026", url: "https://alignment.openai.com/misalignment-reports/suppressing-misalignment-monitoring-alerts-and-disabling-misalignment-monitoring" },
  { id: "tea-illinois", title: "Honeycutt v. Tea Dating Advice, Inc., No. 1:25-cv-10885 (N.D. Ill.), joint status report", by: "CourtListener", date: "13 Aug 2026", url: "https://www.courtlistener.com/docket/71308417/45/honeycutt-v-tea-dating-advice-inc/" },
  { id: "cppa", title: "Updated monetary thresholds in CCPA", by: "California Privacy Protection Agency", date: "effective 1 Jan 2025", url: "https://www.cppa.ca.gov/regulations/cpi_adjustment.html" },
  { id: "lovable-c", title: "We just raised $400M in Series C funding", by: "Lovable", date: "12 Aug 2026", url: "https://lovable.dev/blog/series-c" },
  { id: "wired", title: "Thousands of vibe-coded apps expose corporate and personal data on the open web", by: "WIRED", date: "7 May 2026", url: "https://www.wired.com/story/thousands-of-vibe-coded-apps-expose-corporate-and-personal-data-on-the-open-web/" },
  { id: "coderabbit", title: "Our new report: AI code creates 1.7x more problems", by: "CodeRabbit", date: "17 Dec 2025", url: "https://www.coderabbit.ai/blog/state-of-ai-vs-human-code-generation-report" },
  { id: "metr-study", title: "Measuring the impact of early-2025 AI on experienced open-source developer productivity", by: "METR", date: "10 Jul 2025", url: "https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/" },
  { id: "so-2025", title: "AI, 2025 Stack Overflow Developer Survey", by: "Stack Overflow", date: "29 Jul 2025", url: "https://survey.stackoverflow.co/2025/ai" },
] as const;

type SourceId = (typeof SOURCES)[number]["id"];
const SOURCE_NUMBER = new Map<SourceId, number>(SOURCES.map((s, i) => [s.id, i + 1]));

/** Superscript citation numbers that jump to the Sources list (Design rule 4). */
function C({ s }: { s: SourceId | readonly SourceId[] }) {
  const ids = (typeof s === "string" ? [s] : [...s]).sort((a, b) => (SOURCE_NUMBER.get(a) ?? 0) - (SOURCE_NUMBER.get(b) ?? 0));
  return (
    <sup>
      {ids.map((id, i) => {
        const n = SOURCE_NUMBER.get(id);
        return (
          <Fragment key={id}>
            {i > 0 && ","}
            <a href={`#source-${n}`} aria-label={`Source ${n}`}>{n}</a>
          </Fragment>
        );
      })}
    </sup>
  );
}

type Incident = { when: string; who: string; what: ReactNode; cost: ReactNode };

const INCIDENTS: Incident[] = [
  {
    when: "Mar 2025",
    who: "EnrichLead",
    what: <>Its founder posted that the app was &ldquo;built with Cursor, zero hand written code.&rdquo; Two days later people were maxing out his API keys and bypassing the subscription; he moved the keys into environment variables and added authentication to the API.<C s={["leo-boast", "leo-attack", "leo-fix", "pivot"]} /></>,
    cost: <>He shut the app down 5 days after the first post: &ldquo;you guys were right, I shouldn&apos;t have deployed unsecured code to production.&rdquo;<C s="leo-shutdown" /></>,
  },
  {
    when: "Mar 2025",
    who: "170 apps built with Lovable",
    what: <>A scan of 1,645 apps found 170 whose database had no working row-level security, so anyone could read or write their tables with the public key every visitor gets (CVE-2025-48757). The researchers work at Replit.<C s={["palmer", "cve"]} /></>,
    cost: <>303 exposed endpoints. Lovable disputes the CVE: each customer is responsible for protecting their app&apos;s data.<C s={["palmer", "cve"]} /></>,
  },
  {
    when: "Jul 2025",
    who: "Replit and SaaStr",
    what: <>During a declared code freeze, Replit&apos;s agent deleted the production database of an app SaaStr&apos;s founder was building, then said a rollback was impossible. The rollback worked.<C s={["lemkin-delete", "lemkin-rollback"]} /></>,
    cost: <>By the agent&apos;s own count, records for 1,206 executives and 1,196+ companies, restored by the rollback. Replit&apos;s CEO called it unacceptable and began rolling out separate development and production databases.<C s={["lemkin-delete", "masad"]} /></>,
  },
  {
    when: "Jul 2025",
    who: "Tea",
    what: <>A legacy storage system was breached: about 72,000 images, including about 13,000 selfies and photo IDs. A second exposure held more than 1.1 million private messages.<C s={["tea-statement", "tea-dms"]} /></>,
    cost: <>A dozen federal lawsuits were consolidated into one case; the parties reached a settlement in principle in Jun 2026. The complaint alleges Tea &ldquo;likely used AI-generated code&rdquo;; that is an allegation, not a finding.<C s={["tea-docket", "tea-complaint", "tea-settle"]} /></>,
  },
  {
    when: "Jul 2025",
    who: "Base44 (Wix)",
    what: <>With only a private app&apos;s public app_id, anyone could register a verified account on it, getting around its single sign-on.<C s="wiz-base44" /></>,
    cost: <>Fixed in under 24 hours; Wix found no evidence of abuse.<C s="wiz-base44" /></>,
  },
  {
    when: "Jul 2025",
    who: "Amazon Q",
    what: <>An attacker got a prompt telling the agent to &ldquo;delete file-system and cloud resources&rdquo; into version 1.84.0 of the official VS Code extension. AWS says an over-scoped token in its build setup let them commit it.<C s={["404-q", "aws-q"]} /></>,
    cost: <>AWS says the code failed to run because of a syntax error and no customer resources were affected.<C s="aws-q" /></>,
  },
  {
    when: "Jan 2026",
    who: "Moltbook",
    what: <>A misconfigured Supabase database gave anyone full read and write access to all platform data.<C s="wiz-moltbook" /></>,
    cost: <>1.5 million API tokens and 35,000 email addresses exposed; secured within hours of the report.<C s="wiz-moltbook" /></>,
  },
  {
    when: "Feb 2026",
    who: "An app hosted on Lovable",
    what: <>A researcher found 16 flaws, 6 critical. The access check was backwards: it blocked signed-in users and let everyone else in. He says the logic might have slipped through AI code generation; Lovable says the app includes code it didn&apos;t generate.<C s={["khan", "reg-lovable-app"]} /></>,
    cost: <>18,697 user records readable with no login, from universities and, the researcher says, likely K-12 schools.<C s="khan" /></>,
  },
  {
    when: "Mar 2026",
    who: "Amazon retail",
    what: <>Four Sev-1 incidents in a week. An internal document listed &ldquo;GenAI-assisted changes&rdquo; as a factor in a trend of incidents; the line was deleted before the meeting. Amazon says only one incident involved an AI tool, an engineer following its inaccurate advice, and none involved AI-written code.<C s={["cnbc-amazon", "amazon-statement"]} /></>,
    cost: <>The 2 Mar incident: nearly 120,000 lost orders. An internal review named Amazon&apos;s AI tool Q as a primary contributor; Amazon says the cause was a user error, not AI.<C s={["bi-amazon", "amazon-statement"]} /></>,
  },
  {
    when: "Mar 2026",
    who: "METR",
    what: <>A researcher&apos;s vibe-coded app had a login that failed open. An attacker prompted its agent to reveal an API key and kept access for 3 weeks.<C s="metr-security" /></>,
    cost: <>Credits worth about $600,000, which the model developer had given METR for free. METR believes no sensitive information was accessed.<C s="metr-security" /></>,
  },
  {
    when: "Apr 2026",
    who: "Lovable",
    what: <>A broken access check let any free account read other users&apos; public projects: source code, AI chats and, inside that code, database credentials. Lovable first said it &ldquo;did not suffer a data breach&rdquo;, then that its bug bounty partner had closed the reports.<C s="reg-lovable-bola" /></>,
    cost: <>Lovable says public projects were exposed from 3 Feb to 20 Apr and that it shipped a fix within 2 hours of the public report; it later called its first response dismissive.<C s="lovable-response" /></>,
  },
  {
    when: "Apr 2026",
    who: "PocketOS",
    what: <>A Cursor agent deleted the production database and its backups in one API call, in 9 seconds, with a broadly scoped token it found in an unrelated file. Its rules said never to run destructive git commands unless asked.<C s="crane" /></>,
    cost: <>The company ran for a weekend on a backup 3 months old until its host recovered the data.<C s={["crane", "reg-pocketos"]} /></>,
  },
  {
    when: "Jul and Sep 2026",
    who: "Grok Build, ZCode",
    what: <>Two AI coding tools uploaded whole repositories, git history included, to their vendors&apos; cloud storage, and their privacy settings didn&apos;t stop it.<C s={["cereblab", "thn-grok", "ferstar"]} /></>,
    cost: <>At least 5.1 GiB from one test repository (Grok Build). Researchers saw xAI switch the upload off; Z.ai says it removed the upload and destroyed the data.<C s={["cereblab", "thn-grok", "ferstar"]} /></>,
  },
  {
    when: "Oct 2026",
    who: "Bootlegger Coffee",
    what: <>A dashboard behind a login page sent its data with the login page itself, readable in the page source. MyBroadband called it vibe-coded; the company&apos;s statement doesn&apos;t say how it was built.<C s={["mybroadband", "itweb"]} /></>,
    cost: <>Names and contacts for 132 locations. The company confirmed the exposure and says no customer data was on the platform.<C s={["mybroadband", "itweb"]} /></>,
  },
];

type Verdict = "Direct" | "Partial" | "Out of scope";
const SCORES: { incident: string; cause: string; verdict: Verdict; note?: string }[] = [
  { incident: "EnrichLead", cause: "Keys in the code; API with no authentication", verdict: "Direct" },
  { incident: "170 apps built with Lovable", cause: "No working row-level security", verdict: "Direct" },
  { incident: "Moltbook", cause: "Database open to public read and write", verdict: "Direct" },
  { incident: "An app hosted on Lovable", cause: "Access check that looked right but was backwards", verdict: "Direct" },
  { incident: "METR", cause: "Login that failed open", verdict: "Direct" },
  { incident: "Bootlegger Coffee", cause: "Data sent with the login page", verdict: "Direct" },
  { incident: "Tea", cause: "Legacy storage system breached", verdict: "Partial" },
  { incident: "Amazon retail", cause: "Engineer followed inaccurate AI advice", verdict: "Partial" },
  { incident: "Replit and SaaStr", cause: "Agent with production access", verdict: "Partial", note: "needs permissions too" },
  { incident: "PocketOS", cause: "Agent with production access", verdict: "Partial", note: "needs permissions too" },
  { incident: "Lovable", cause: "The vendor's own access bug", verdict: "Out of scope" },
  { incident: "Base44 (Wix)", cause: "The vendor's own sign-in bug", verdict: "Out of scope" },
  { incident: "Amazon Q", cause: "Supply-chain attack", verdict: "Out of scope" },
  { incident: "Grok Build, ZCode", cause: "Tools uploading repositories", verdict: "Out of scope", note: "a design lesson" },
];

const LIMITS: { finding: string; number: string; source: ReactNode }[] = [
  { finding: "Issues per pull request, AI co-authored vs human only (470 open-source PRs)", number: "10.83 vs 6.45, about 1.7x", source: <>CodeRabbit, Dec 2025, which sells AI code review<C s="coderabbit" /></> },
  { finding: "Time to finish an issue with early-2025 AI tools, 16 experienced open-source developers on their own repositories", number: "19% longer", source: <>METR, Jul 2025; METR now calls these results out of date<C s="metr-study" /></> },
  { finding: "Developers who distrust AI accuracy vs trust it", number: "46% vs 33%", source: <>Stack Overflow, 2025 survey<C s="so-2025" /></> },
  { finding: "Developers who cite AI answers that are \u201calmost right, but not quite\u201d as a frustration (the most-cited one)", number: "66%", source: <>Stack Overflow, 2025 survey<C s="so-2025" /></> },
];

export default function WhyPage() {
  return (
    <article className="fos-page why-page">
      <header className="fos-page__head">
        <h1>Nobody read the code</h1>
        <p className="fos-page__lead">
          Vibe coding didn&apos;t fail because AI writes bad code. It failed because people shipped code they never read. We went
          through 20 months of public incidents, lawsuits and research, from a SaaS app shut down in a week to an agent that
          deleted a company&apos;s database in 9 seconds. The same root cause keeps coming up: code reached production and nobody
          understood it. That is the gap Unvibe is built to close.
        </p>
      </header>

      <figure className="why-shot">
        {/* eslint-disable-next-line @next/next/no-img-element -- a real capture at its own size, as on the home page */}
        <img src={KEY_CHECK_SHOT.src} width={KEY_CHECK_SHOT.width} height={KEY_CHECK_SHOT.height} alt={KEY_CHECK_SHOT.alt} loading="eager" />
        <figcaption>Key check · {SHOT_CAPTION}</figcaption>
      </figure>

      <section className="verify" aria-labelledby="why-numbers">
        <h2 id="why-numbers">The numbers</h2>
        <ul className="why-figures">
          <li>
            <b>75%</b>
            <span>of all new code at Google is AI-generated and approved by engineers, up from more than a quarter in Oct 2024.</span>
            <small>Google, Apr 2026<C s={["google-2026", "google-2024"]} /></small>
          </li>
          <li>
            <b>38%</b>
            <span>of AI coding tasks produced vulnerable code when the model had no security-specific guidance.</span>
            <small>Veracode, Oct 2026, 18 models<C s="veracode-2026" /></small>
          </li>
          <li>
            <b>$4.99M</b>
            <span>average cost of a data breach, a record high.</span>
            <small>IBM, 2026<C s="ibm-2026" /></small>
          </li>
          <li>
            <b>35</b>
            <span>vulnerabilities traced to AI-written code in Mar 2026 alone, up from 6 in Jan. The researchers call it a lower bound.</span>
            <small>Georgia Tech, Apr 2026<C s={["infosec-gatech", "gatech"]} /></small>
          </li>
        </ul>
      </section>

      <section className="verify" aria-labelledby="why-ledger">
        <h2 id="why-ledger">14 incidents, one pattern</h2>
        <p>Every one of these is publicly documented. Where a company disputes the account, its position is in the same row.</p>
        <table className="why-table" role="table">
          <thead>
            <tr role="row"><th scope="col" role="columnheader">Who</th><th scope="col" role="columnheader">When</th><th scope="col" role="columnheader">What happened</th><th scope="col" role="columnheader">The cost</th></tr>
          </thead>
          <tbody>
            {INCIDENTS.map((row) => (
              <tr key={row.who} role="row">
                <th scope="row" role="rowheader">{row.who}</th>
                <td data-label="When" className="why-num" role="cell">{row.when}</td>
                <td data-label="What happened" role="cell">{row.what}</td>
                <td data-label="The cost" role="cell">{row.cost}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="verify" aria-labelledby="why-bigtech">
        <h2 id="why-bigtech">Big tech writes more code with AI too</h2>
        <ul>
          <li><b>Google:</b> 75% of new code is AI-generated and approved by engineers, and some engineers have AI goals that count in their 2026 performance reviews.<C s={["google-2026", "bi-google"]} /></li>
          <li><b>Microsoft:</b> in Apr 2025 Satya Nadella estimated that &ldquo;maybe 20%, 30%&rdquo; of the code in some projects is written by software.<C s="cnbc-nadella" /></li>
          <li><b>Meta:</b> an internal document set a goal for late 2025 that 55% of engineers&apos; code changes in its central product orgs be &ldquo;Agent-Assisted&rdquo;.<C s="bi-meta" /></li>
          <li><b>Snap:</b> at least 65% of new code is generated by AI, its Apr 2026 investor update says.<C s="snap" /></li>
          <li><b>Amazon:</b> a director in Amazon Stores said in Apr 2026: &ldquo;Right now, every mutating step that an AI might do requires a human to approve it.&rdquo;<C s="reg-amazon-review" /></li>
          <li><b>OpenAI:</b> two of its internal coding agents weakened safety monitoring during routine coding tasks. One silenced alerts to the security team; the other removed a monitor, then told the user it hadn&apos;t.<C s="openai" /></li>
        </ul>
      </section>

      <section className="verify" aria-labelledby="why-law">
        <h2 id="why-law">Lawsuits and money</h2>
        <p>
          We know of no court that has ruled on &ldquo;vibe coding&rdquo; as a legal theory. The lawsuits are about what leaks. In
          Tea&apos;s case, a dozen federal lawsuits were consolidated into one case in California, and separate suits in Illinois
          are filed under its biometric privacy law.<C s={["tea-docket", "tea-illinois"]} /> Under California&apos;s consumer privacy law, a breach
          caused by poor security can cost $107 to $799 per consumer per incident, or actual damages if higher.<C s="cppa" />
        </p>
        <p>
          The platforms are worth a lot and put security on the builder. Lovable raised money at a $13.3B valuation in Aug 2026,
          with teams at Zendesk and Deutsche Telekom among its users.<C s="lovable-c" /> In May 2026 the security firm RedAccess
          told WIRED it had found more than 5,000 apps built with Lovable, Replit, Base44 and Netlify with virtually no
          authentication. WIRED couldn&apos;t confirm the data was real, and the platforms pushed back. Lovable told WIRED that how
          an app is configured is the creator&apos;s responsibility, Base44 said it gives users the tools to configure their own
          apps&apos; security, and Replit&apos;s CEO said public apps being reachable is expected behavior.<C s="wired" /> If the
          platform won&apos;t own your app&apos;s security, you have to understand it yourself.
        </p>
      </section>

      <section className="verify" aria-labelledby="why-limits">
        <h2 id="why-limits">The limits, measured</h2>
        <table className="why-table" role="table">
          <thead>
            <tr role="row"><th scope="col" role="columnheader">Finding</th><th scope="col" role="columnheader">Number</th><th scope="col" role="columnheader">Source</th></tr>
          </thead>
          <tbody>
            {LIMITS.map((row) => (
              <tr key={row.finding} role="row">
                <th scope="row" role="rowheader">{row.finding}</th>
                <td data-label="Number" className="why-num" role="cell">{row.number}</td>
                <td data-label="Source" role="cell">{row.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>&ldquo;Almost right&rdquo; is the dangerous part. Code that fails loudly gets fixed. Code that looks right ships.</p>
      </section>

      <section className="verify" aria-labelledby="why-score">
        <h2 id="why-score">Would understanding the code have stopped it?</h2>
        <p>
          We scored every incident above, including the ones Unvibe can&apos;t help with. In 6, a builder who read and understood
          the code would have caught the flaw before launch. In 4, understanding would have helped but wasn&apos;t enough on its
          own. 4 were platform or supply-chain failures no builder could have fixed.
        </p>
        <table className="why-table" role="table">
          <thead>
            <tr role="row"><th scope="col" role="columnheader">Incident</th><th scope="col" role="columnheader">Root cause</th><th scope="col" role="columnheader">Verdict</th></tr>
          </thead>
          <tbody>
            {SCORES.map((row) => (
              <tr key={row.incident} role="row">
                <th scope="row" role="rowheader">{row.incident}</th>
                <td data-label="Root cause" role="cell">{row.cause}</td>
                <td data-label="Verdict" role="cell"><span className="why-verdict">{row.verdict}</span>{row.note && `, ${row.note}`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="verify" aria-labelledby="why-built">
        <h2 id="why-built">Why we built Unvibe</h2>
        <p>
          AI made writing code cheap. Understanding it is still expensive, and that is where the damage happens. The industry&apos;s
          answer is more AI to review the AI. Ours is simpler: the person who ships the code should understand it. Not every line
          forever. Just the parts that touch keys, logins, data and money.
        </p>
        <p>
          Unvibe is a free desktop app for Mac and Windows. Select code in any app, like Cursor, VS Code, Terminal or, on a Mac,
          Xcode, and press {mac.anywhere} ({windows.anywhere} on Windows). It explains the code beside your editor at your level,
          from New to Advanced. Then Test me asks up to 3 questions about the code you just read.
        </p>
        <h3>Mapped to the failures</h3>
        <ul>
          <li><b>A key in the code (EnrichLead):</b> Unvibe checks for keys and tokens on your computer first, and a known key stops the request, as in the picture above.</li>
          <li><b>Access that looks right (the Lovable-hosted app, Moltbook, METR):</b> ask &ldquo;What breaks if I remove it?&rdquo; before you ship it.</li>
          <li><b>Agents changing things nobody reviewed (Replit, PocketOS):</b> Briefs recap your git changes in plain English and list what to review first.</li>
          <li>
            <b>Tools uploading your repository (Grok Build, ZCode):</b> Unvibe sends the code you select, with its file path inside
            your project (on Pro, plus up to two files it imports, the first 4,000 characters of each), or a git diff when you ask a
            Brief to explain one. It doesn&apos;t read your repository in the background, and it never changes your code. The{" "}
            <Link href="/privacy">privacy page</Link> explains what leaves your computer.
          </li>
        </ul>
      </section>

      <section className="verify" aria-labelledby="why-wont">
        <h2 id="why-wont">What it won&apos;t do</h2>
        <ul>
          <li>Unvibe is not a security scanner, a firewall or a permission system.</li>
          <li>It won&apos;t stop an agent that has production credentials.</li>
          <li>It won&apos;t patch your vendor&apos;s bugs.</li>
          <li>Its explanations can be wrong, which is why they sit next to the code, so you can check them.</li>
        </ul>
        <p>What it does is help make sure the code you ship is code you understand.</p>
        <p>
          <Link className="about-page__btn about-page__btn--lime" href="/beta">Download free</Link>
        </p>
      </section>

      <section className="verify" aria-labelledby="why-sources">
        <h2 id="why-sources">Sources</h2>
        <p>Every source was opened and checked on 7 Nov 2026. Quotes from posts on X keep their original spelling.</p>
        <ol className="why-sources">
          {SOURCES.map((s, i) => (
            <li key={s.id} id={`source-${i + 1}`}>
              {s.by}, {s.date}:{" "}
              <a href={s.url} rel="noopener noreferrer">{s.title}</a>
            </li>
          ))}
        </ol>
      </section>

      <p className="fos-page__help">
        More about us: <Link href="/about">About Unvibe</Link> and <Link href="/build">how we build it</Link>.
      </p>
    </article>
  );
}
