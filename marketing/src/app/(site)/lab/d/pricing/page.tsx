import type { Metadata } from "next";
import "@/site/dia/dia.css";
import "@/site/dia/motion/dia-motion.css";
import { DiaPricing } from "@/site/dia/DiaPricing";

// LAB ONLY (branch unvibe-site/dia-lab, never pushed): direction D pricing with the Pro-hover background swap.
export const metadata: Metadata = { title: "Unvibe · lab D pricing", robots: { index: false, follow: false } };

export default function LabDPricing() {
  return <DiaPricing />;
}
