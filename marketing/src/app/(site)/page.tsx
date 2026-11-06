import type { Metadata } from "next";
import { faqPageJsonLd, howToJsonLd, jsonLdScript, websiteJsonLd } from "@/lib/jsonLd";
import { pageMetadata } from "@/lib/pageMeta";
import { fetchPaymentsOpen } from "@/lib/paymentsStatus";
import { SHORTCUTS } from "@/lib/shortcuts";
import { FAQ } from "@/site/content";
import { Home } from "@/site/Home";

export const metadata: Metadata = pageMetadata({
  path: "/",
  title: "Unvibe: Explain AI-Written Code in Plain English, Free",
  absolute: true,
  description: `Unvibe is a free code explainer for Mac and Windows. Select AI-written code in any app, press ${SHORTCUTS.mac.anywhere} (${SHORTCUTS.windows.anywhere} on Windows), and read it in plain English.`,
});

/** Only what the page shows: the four answers under Questions and the tour's three steps. */
const homeJsonLd = [
  websiteJsonLd,
  faqPageJsonLd(FAQ.items),
  howToJsonLd("How to understand AI-written code with Unvibe", [
    { name: "Select code", text: "Select code in any app." },
    { name: `Press ${SHORTCUTS.mac.anywhere}`, text: `Press ${SHORTCUTS.mac.anywhere} (${SHORTCUTS.windows.anywhere} on Windows).` },
    { name: "Read it beside your editor", text: "Read the explanation beside your editor." },
  ]),
];

export const revalidate = 300;

/** paymentsOpen is the API's live status (cached with revalidate); the price card's closed line depends on it. */
export default async function HomePage() {
  const paymentsOpen = await fetchPaymentsOpen();
  return (
    <>
      {homeJsonLd.map((value) => (
        <script key={String(value["@type"])} type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(value) }} />
      ))}
      <Home paymentsOpen={paymentsOpen} />
    </>
  );
}
