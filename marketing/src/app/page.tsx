import dynamic from "next/dynamic";
import { Hero } from "@/components/sections/Hero";
import { BrandLogos } from "@/components/BrandLogos";
import { OpeningStrip } from "@/components/sections/OpeningStrip";
import { Problem } from "@/components/sections/Problem";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { Features } from "@/components/sections/Features";
import { WorksWhere } from "@/components/sections/WorksWhere";
import { DepthDemo } from "@/components/sections/DepthDemo";
import { DemoSection } from "@/components/sections/DemoSection";
import { Privacy } from "@/components/sections/Privacy";
import { LanguageExplorer } from "@/components/sections/LanguageExplorer";
import { LearningEngine } from "@/components/sections/LearningEngine";
import { StudyFromProjects } from "@/components/sections/StudyFromProjects";
import { StudentStories } from "@/components/sections/StudentStories";
import { Download } from "@/components/sections/Download";
import { Waitlist } from "@/components/sections/Waitlist";
import { Faq } from "@/components/sections/Faq";
import { FinalCta } from "@/components/sections/FinalCta";
import { FaqJsonLd } from "@/components/JsonLd";

const Assessment = dynamic(
  () => import("@/components/sections/Assessment").then((m) => m.Assessment),
  { loading: () => <SectionSkeleton /> }
);

/**
 * Full landing page. Sections ordered for a clear narrative arc:
 * Hook → Pain/Solution → Capabilities → Interactive proof → Breadth → Social proof → Trust/Action → Close
 */
export default function Home() {
  return (
    <>
      <FaqJsonLd />

      {/* Hook */}
      <Hero />
      <BrandLogos />

      {/* Pain → Solution */}
      <Problem />
      <HowItWorks />

      {/* Capabilities */}
      <Features />
      <WorksWhere />

      {/* Interactive proof */}
      <DemoSection />
      <DepthDemo />
      <Assessment />

      {/* Product screens */}
      <OpeningStrip />

      {/* Breadth */}
      <LanguageExplorer />
      <LearningEngine />

      {/* Social proof / use cases */}
      <StudyFromProjects />
      <StudentStories />

      {/* Trust → Action */}
      <Privacy />
      <Download />
      <Waitlist />

      {/* Close */}
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
