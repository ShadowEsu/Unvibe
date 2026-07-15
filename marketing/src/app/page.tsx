import dynamic from "next/dynamic";
import { Hero } from "@/components/sections/Hero";
import { BrandLogos } from "@/components/BrandLogos";
import { Problem } from "@/components/sections/Problem";
import { DemoSection } from "@/components/sections/DemoSection";
import { DepthDemo } from "@/components/sections/DepthDemo";
import { ContextStory } from "@/components/sections/ContextStory";
import { OpeningStrip } from "@/components/sections/OpeningStrip";
import { Privacy } from "@/components/sections/Privacy";
import { Pricing } from "@/components/sections/Pricing";
import { Waitlist } from "@/components/sections/Waitlist";
import { Faq } from "@/components/sections/Faq";
import { FinalCta } from "@/components/sections/FinalCta";
import { FaqJsonLd } from "@/components/JsonLd";

const Assessment = dynamic(
  () => import("@/components/sections/Assessment").then((m) => m.Assessment),
  { loading: () => <SectionSkeleton /> }
);

/**
 * Focused beta landing page: product proof first, supporting detail only where it earns trust.
 */
export default function Home() {
  return (
    <>
      <FaqJsonLd />

      <Hero />
      <BrandLogos />
      <Problem />
      <DemoSection />
      <DepthDemo />
      <ContextStory />
      <Assessment />
      <OpeningStrip />
      <Privacy />
      <Pricing />
      <Waitlist />
      <Faq />
      <FinalCta />
    </>
  );
}

function SectionSkeleton() {
  return (
    <div className="container-page py-20 sm:py-28" aria-hidden="true">
      <div className="h-6 w-40 animate-pulse rounded-full bg-surface-2" />
      <div className="mt-4 h-10 w-2/3 animate-pulse rounded-lg bg-surface-2" />
      <div className="mt-8 h-48 w-full animate-pulse rounded-card bg-surface-2" />
    </div>
  );
}
