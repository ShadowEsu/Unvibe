import type { Metadata, Viewport } from "next";
import { Home } from "@/site/dia/Home";
import { D_FAQ, D_STEPS } from "@/site/dia/content";
import { faqItems } from "@/data/faq";
import { SHORTCUTS } from "@/lib/shortcuts";
import { faqPageJsonLd, howToJsonLd, jsonLdScript, websiteJsonLd } from "@/lib/jsonLd";
import { pageMetadata } from "@/lib/pageMeta";
import { fetchPaymentsOpen } from "@/lib/paymentsStatus";
import { pricingCopy } from "@/lib/pricingCopy";

export const metadata: Metadata = pageMetadata({
  path: "/",
  title: "Unvibe: Explain AI-Written Code in Plain English, Free",
  absolute: true,
  description: `Unvibe is a free code explainer for Mac and Windows. Select AI-written code in any app, press ${SHORTCUTS.mac.anywhere} (${SHORTCUTS.windows.anywhere} on Windows), and read it in plain English.`,
});

/** The seven Short answers the page shows, in its order. */
const homeFaq = D_FAQ.ids.flatMap((id) => faqItems.filter((item) => item.id === id));

const macText = (v: string | { readonly mac: string }) => (typeof v === "string" ? v : v.mac);

/** Only what the page shows: the Short answers and the three How it works steps. */
const homeJsonLd = [
  websiteJsonLd,
  faqPageJsonLd(homeFaq),
  howToJsonLd(
    "How to understand AI-written code with Unvibe",
    D_STEPS.items.map((step) => ({ name: macText(step.title), text: `${macText(step.title)}. ${macText(step.body)}` })),
  ),
];

export const revalidate = 300;

/** The browser bar matches the violet field the page opens on. */
export const viewport: Viewport = { themeColor: "#4b2fc0" };

/** Direction D (PLAN rev 3, Preston's OK 6 Nov). The header, footer and cursor come from the root layout. */
export default async function HomePage() {
  const copy = pricingCopy(await fetchPaymentsOpen());
  return (
    <>
      {homeJsonLd.map((value) => (
        <script key={String(value["@type"])} type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(value) }} />
      ))}
      <Home copy={copy} faq={homeFaq.map(({ id, question, answer }) => ({ id, question, answer }))} />
    </>
  );
}
