"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { track } from "@/lib/analytics";

/** Phone-only bar that appears after the hero so the download is one tap away. */
export function MobileDownloadBar() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const nearBottom = window.innerHeight + window.scrollY > document.documentElement.scrollHeight - 420;
      setVisible(window.scrollY > window.innerHeight * 0.85 && !nearBottom);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (pathname?.startsWith("/beta") || pathname?.startsWith("/founder") || pathname?.startsWith("/stats") || pathname?.startsWith("/waitlist")) return null;

  return (
    <div className={visible ? "mobile-dl is-in" : "mobile-dl"} aria-hidden={!visible}>
      <span>Free for Mac and Windows</span>
      <a href="/beta" tabIndex={visible ? 0 : -1} onClick={() => track("download_cta_clicked", { platform: "generic", surface: "mobile_bar" })}>
        Download
      </a>
    </div>
  );
}
