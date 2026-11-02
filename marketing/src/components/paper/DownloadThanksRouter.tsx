"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { registerThanksNavigation } from "@/lib/downloadThanks";

/** Lets a download click open /download/thanks as a client navigation (see downloadThanks.ts). Renders nothing. */
export function DownloadThanksRouter() {
  const router = useRouter();
  useEffect(() => registerThanksNavigation((href) => router.push(href)), [router]);
  return null;
}
