import type { Metadata } from "next";
import { OG_CARDS, pageMetadata } from "@/lib/pageMeta";
import { WhyNote } from "@/site/dia/WhyNote";

export const metadata: Metadata = pageMetadata({
  path: "/why",
  title: "Nobody Read the Code: Why Unvibe Exists",
  absolute: true,
  description: "Fourteen public incidents, the research and the lawsuits behind vibe coding, each with its source, and why understanding the code you ship is the fix.",
  card: OG_CARDS.why,
});

/** The founder's note "Nobody Read the Code" (7 Nov 2026), linked from home's problem section and the header. */
export default function WhyPage() {
  return <WhyNote />;
}
