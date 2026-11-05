import { faqCategories, faqItems } from "@/data/faq";
import { STEPS } from "@/data/howItWorks";
import { FREE_MONTHLY_ALLOWANCE, SIGNED_OUT_ALLOWANCE } from "@/lib/allowance";
import { BETA_INSTALL_VERSION } from "@/lib/betaOffer";
import { explainLanguage, explainPages } from "@/lib/explainPages";
import { PRICING } from "@/lib/pricing";
import { proSentence } from "@/lib/proOffer";
import { PRODUCT_FEATURES, PRODUCT_HOW, PRODUCT_SENTENCE } from "@/lib/productFacts";
import { SITE_URL } from "@/lib/siteUrl";
import { USE_CASES_INDEX, pathForUseCase, useCases } from "@/lib/useCases";

/**
 * /llms.txt and /llms-full.txt (the llmstxt.org format): what Unvibe is, for AI assistants that read
 * a site before they answer about it. Built from the same data the pages show (FAQ, prices, allowances,
 * version, use cases, language pages), so it can't drift from the site. Google Search ignores these
 * files; they are for other assistants (seo skill, AI search).
 */

const url = (path: string) => (path === "/" ? `${SITE_URL}/` : `${SITE_URL}${path}`);
const answer = (id: string) => faqItems.find((item) => item.id === id)?.answer ?? "";

function facts(): string[] {
  return [
    `- Platforms: macOS (Apple silicon or Intel) and Windows 10 and 11 (x64). Desktop app, not a browser extension.`,
    `- Current version: ${BETA_INSTALL_VERSION.replace(/^v/, "")}, a free public beta. Download: ${url("/beta")}`,
    `- Price: Free is $0. Pro is $${PRICING.proMonthly} a month or $${PRICING.proAnnual} a year. ${proSentence()}`,
    `- Free allowance: ${SIGNED_OUT_ALLOWANCE}, then ${FREE_MONTHLY_ALLOWANCE} when you sign in. No card and no API key.`,
    `- Explanations come from Anthropic's Claude API during the beta, or from your own provider (Gemini, OpenAI, Anthropic, Grok, DeepSeek or Kimi) if you add your own API key in Settings; that key stays encrypted on your computer and is never sent to Unvibe. AI explanations can be wrong; each one sits next to the code it describes so you can check it.`,
    `- What gets sent to the AI: ${answer("sent")} It never records your screen or uses OCR. Details: ${url("/privacy")}`,
  ];
}

function pages(): string[] {
  return [
    `- [Home](${url("/")}): what Unvibe does, a recorded demo, how it works, pricing and short answers`,
    `- [Download](${url("/beta")}): free for Mac and Windows`,
    `- [FAQ](${url("/faq")}): every question and answer about Unvibe on one page`,
    `- [Pricing](${url("/pricing")}): Free and Pro`,
    `- [Code explainer for Mac](${url("/code-explainer-mac")})`,
    `- [Code explainer for Windows](${url("/code-explainer-windows")})`,
    `- [Use cases](${url(USE_CASES_INDEX.path)}): ${USE_CASES_INDEX.description}`,
    ...useCases.map((useCase) => `- [${useCase.title}](${url(pathForUseCase(useCase))}): ${useCase.description}`),
    `- [Explain code in your browser](${url("/explain")}): paste code and get a real explanation online, no download`,
    `- [Install help](${url("/install-help")})`,
    `- [Changelog](${url("/releases")})`,
    `- [Privacy](${url("/privacy")})`,
  ];
}

export function llmsTxt(): string {
  return [
    "# Unvibe",
    "",
    `> ${PRODUCT_SENTENCE} ${PRODUCT_HOW}`,
    "",
    "## Key facts",
    "",
    ...facts(),
    "",
    "## What it does",
    "",
    ...PRODUCT_FEATURES.map((feature) => `- ${feature}`),
    "",
    "## Pages",
    "",
    ...pages(),
    "",
    "## Optional",
    "",
    `- [Full text for AI assistants](${url("/llms-full.txt")}): these facts plus every FAQ answer, the steps and the language pages`,
    `- Contact: support@unvibe.site`,
    "",
  ].join("\n");
}

export function llmsFullTxt(): string {
  const byCategory = (Object.keys(faqCategories) as (keyof typeof faqCategories)[]).flatMap((category) => [
    `### ${faqCategories[category]}`,
    "",
    ...faqItems
      .filter((item) => item.category === category)
      .flatMap((item) => [`#### ${item.question}`, "", item.answer, ""]),
  ]);
  return [
    llmsTxt().trimEnd(),
    "",
    "## How it works",
    "",
    ...STEPS.map((step, index) => `${index + 1}. ${step.title}${step.body ? ` ${step.body}` : ""}`),
    "",
    "## Questions and answers",
    "",
    ...byCategory,
    "## Explain code by language",
    "",
    ...explainPages.map((page) => `- [Explain ${explainLanguage(page).name} code](${url(`/explain/${page.id}`)})`),
    "",
  ].join("\n");
}
