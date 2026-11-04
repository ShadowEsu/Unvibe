"use client";

import { useEffect } from "react";

/**
 * /releases#<anchor> for an entry in a closed month: open that month's <details> and scroll the entry into view, on
 * load and on every hash change. Find-in-page already reaches closed months in browsers that search <details>.
 */
export function ChangelogHashOpen() {
  useEffect(() => {
    const open = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (!id) return;
      const target = document.getElementById(id);
      const month = target?.closest("details");
      if (!target || !month) return;
      if (!month.open) month.open = true;
      target.scrollIntoView({ block: "start" });
    };
    open();
    window.addEventListener("hashchange", open);
    return () => window.removeEventListener("hashchange", open);
  }, []);
  return null;
}
