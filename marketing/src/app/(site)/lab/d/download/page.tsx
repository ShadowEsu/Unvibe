import type { Metadata } from "next";
import "@/site/dia/dia.css";
import "@/site/dia/motion/dia-motion.css";
import { DiaDownload } from "@/site/dia/DiaDownload";

// LAB ONLY (branch unvibe-site/dia-lab, never pushed): direction D /download, the live InstallBox restyled.
export const metadata: Metadata = { title: "Unvibe · lab D download", robots: { index: false, follow: false } };

export default function LabDDownload() {
  return <DiaDownload />;
}
