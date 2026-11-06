import type { Metadata } from "next";
import "@/site/dia/dia.css";
import "@/site/dia/motion/dia-motion.css";
import { DiaHome } from "@/site/dia/DiaHome";

// LAB ONLY (branch unvibe-site/dia-lab, never pushed): direction D, Dia's structure in Unvibe purple.
export const metadata: Metadata = { title: "Unvibe · lab D", robots: { index: false, follow: false } };

export default function LabDHome() {
  return <DiaHome />;
}
