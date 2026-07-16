import { Hero } from "@/components/sections/Hero";
import { Problem } from "@/components/sections/Problem";
import { DemoSection } from "@/components/sections/DemoSection";
import { DepthDemo } from "@/components/sections/DepthDemo";
import { ContextStory } from "@/components/sections/ContextStory";
import { WorksWhere } from "@/components/sections/WorksWhere";
import { StudyFromProjects } from "@/components/sections/StudyFromProjects";
import { ProductGallery } from "@/components/sections/ProductGallery";
import { Privacy } from "@/components/sections/Privacy";
import { Waitlist } from "@/components/sections/Waitlist";
import { Faq } from "@/components/sections/Faq";
import { FinalCta } from "@/components/sections/FinalCta";
import { FaqJsonLd } from "@/components/JsonLd";

/**
 * Focused beta landing page: product proof first, supporting detail only where it earns trust.
 */
export default function Home() {
  return (
    <>
      <FaqJsonLd />

      <Hero />
      <Problem />
      <DemoSection />
      <DepthDemo />
      <ContextStory />
      <WorksWhere />
      <StudyFromProjects />
      <ProductGallery />
      <Privacy />
      <Waitlist />
      <Faq />
      <FinalCta />
    </>
  );
}
