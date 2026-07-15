import dynamic from "next/dynamic";
import { Hero } from "@/components/sections/Hero";
import { Problem } from "@/components/sections/Problem";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { WorksWhere } from "@/components/sections/WorksWhere";
import { DepthDemo } from "@/components/sections/DepthDemo";
import { ProjectMap } from "@/components/sections/ProjectMap";
import { StudyFromProjects } from "@/components/sections/StudyFromProjects";
import { LearningEngine } from "@/components/sections/LearningEngine";
import { Privacy } from "@/components/sections/Privacy";
import { Waitlist } from "@/components/sections/Waitlist";
import { Faq } from "@/components/sections/Faq";
import { FinalCta } from "@/components/sections/FinalCta";
import { FaqJsonLd } from "@/components/JsonLd";

const LanguageExplorer = dynamic(
  () => import("@/components/sections/LanguageExplorer").then((m) => m.LanguageExplorer),
  { loading: () => <SectionSkeleton /> }
);

const ProductGallery = dynamic(
  () => import("@/components/sections/ProductGallery").then((m) => m.ProductGallery),
  { loading: () => <SectionSkeleton /> }
);

const Assessment = dynamic(
  () => import("@/components/sections/Assessment").then((m) => m.Assessment),
  { loading: () => <SectionSkeleton /> }
);

/**
 * Narrative-driven launch page.
 * Each section builds toward the next, demonstrating the product
 * before asking for a signup.
 */
export default function Home() {
  return (
    <>
      <FaqJsonLd />
      <Hero />
      <Problem />
      <HowItWorks />
      <WorksWhere />
      <DepthDemo />
      <ProjectMap />
      <StudyFromProjects />
      <LanguageExplorer />
      <LearningEngine />
      <Assessment />
      <ProductGallery />
      <Privacy />
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
