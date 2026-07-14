import dynamic from "next/dynamic";
import { Hero } from "@/components/sections/Hero";
import { BrandLogos } from "@/components/BrandLogos";
import { OpeningStrip } from "@/components/sections/OpeningStrip";
import { Problem } from "@/components/sections/Problem";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { DepthDemo } from "@/components/sections/DepthDemo";
import { Privacy } from "@/components/sections/Privacy";
import { Waitlist } from "@/components/sections/Waitlist";
import { Download } from "@/components/sections/Download";
import { Faq } from "@/components/sections/Faq";
import { FinalCta } from "@/components/sections/FinalCta";
import { FaqJsonLd } from "@/components/JsonLd";

const Assessment = dynamic(
  () => import("@/components/sections/Assessment").then((m) => m.Assessment),
  { loading: () => <SectionSkeleton /> }
);

/**
 * Tight launch page for builders. The interactive product walkthrough is the demo source of
 * truth, so the landing page never presents a broken or placeholder video player.
 */
export default function Home() {
  return (
    <>
      <FaqJsonLd />
      <Hero />
      <BrandLogos />
      <OpeningStrip />
      <Problem />
      <HowItWorks />
      <DepthDemo />
      <Assessment />
      <Privacy />
      <Download />
      <Waitlist />
      <Faq />
      <FinalCta />
    </>
  );
}

function SectionSkeleton() {
  return (
    <div className="container-page py-16" aria-hidden="true">
      <div className="h-6 w-40 animate-pulse rounded-full bg-surface-2" />
      <div className="mt-4 h-10 w-2/3 animate-pulse rounded-lg bg-surface-2" />
      <div className="mt-8 h-48 w-full animate-pulse rounded-card bg-surface-2" />
    </div>
  );
}
