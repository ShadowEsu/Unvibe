"use client";

import { usePathname } from "next/navigation";
import { Announcement } from "@/components/Announcement";

/** Keeps the general-site announcement out of the dedicated investor surface. */
export function SiteAnnouncement() {
  const pathname = usePathname();

  if (pathname === "/investors" || pathname.startsWith("/investors/")) {
    return null;
  }

  return <Announcement />;
}
