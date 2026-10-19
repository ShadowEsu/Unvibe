"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { track } from "@/lib/analytics";
import { detectVisitorDevice } from "@/lib/shortcuts";

/**
 * Small-screen bar that appears after the hero. On a phone the useful action is getting the
 * link by email (the hero form); a narrow desktop window still gets the download.
 */
export function MobileDownloadBar() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [phone, setPhone] = useState(false);

  useEffect(() => {
    setPhone(detectVisitorDevice(navigator.userAgent, navigator.maxTouchPoints) === "phone");
    const hero = document.querySelector(".vhero");
    const onScroll = () => {
      const nearBottom = window.innerHeight + window.scrollY > document.documentElement.scrollHeight - 420;
      const pastHero = hero ? hero.getBoundingClientRect().bottom <= 0 : window.scrollY > window.innerHeight * 0.85;
      setVisible(pastHero && !nearBottom);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [pathname]);

  if (pathname?.startsWith("/beta") || pathname?.startsWith("/founder") || pathname?.startsWith("/stats") || pathname?.startsWith("/s/") || pathname?.startsWith("/waitlist")) return null;

  return (
    <div className={visible ? "mobile-dl is-in" : "mobile-dl"} aria-hidden={!visible}>
      <span>{phone ? "Free for your Mac or PC" : "Free for Mac and Windows"}</span>
      {phone ? (
        <a href="/#email-link" tabIndex={visible ? 0 : -1} onClick={() => track("email_link_cta_clicked", { surface: "mobile_bar" })}>
          Email me the link
        </a>
      ) : (
        <a href="/beta" tabIndex={visible ? 0 : -1} onClick={() => track("download_cta_clicked", { platform: "generic", surface: "mobile_bar" })}>
          Download
        </a>
      )}
    </div>
  );
}
