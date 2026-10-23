"use client";

import { useEffect, useRef } from "react";
import { trackInstallHelpViewed } from "@/lib/downloadTracking";

/** Sends `install_help_viewed` once per /install-help page view. Renders nothing. */
export function InstallHelpViewed() {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    trackInstallHelpViewed();
  }, []);
  return null;
}
