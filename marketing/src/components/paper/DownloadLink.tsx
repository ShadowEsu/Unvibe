"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { DownloadSurface } from "@/lib/downloadTracking";
import { detectVisitorDevice } from "@/lib/shortcuts";
import { DownloadCta } from "@/site/dia/DownloadCta";

/**
 * "Download free for Mac" and "Download free for Windows" (/releases, /build, /resources): each click starts that
 * computer's v0.1.49 file and opens the thank-you state (DownloadCta). No OS logos (Security MUST-D1). A phone gets
 * one link to the emailed-link form instead.
 */
export function DownloadRow({ surface }: { surface: DownloadSurface }) {
  const [phone, setPhone] = useState(false);
  useEffect(() => setPhone(detectVisitorDevice(navigator.userAgent, navigator.maxTouchPoints) === "phone"), []);
  if (phone) {
    return (
      <div className="paper-join-row">
        <Link href="/beta#email-link" className="d-cta d-btn">Email me the link</Link>
      </div>
    );
  }
  return (
    <div className="paper-join-row">
      <DownloadCta surface={surface} platform="mac">Download free for Mac</DownloadCta>
      <DownloadCta surface={surface} platform="windows">Download free for Windows</DownloadCta>
    </div>
  );
}
