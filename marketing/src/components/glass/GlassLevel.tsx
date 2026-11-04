"use client";

import { useEffect, useSyncExternalStore } from "react";
import { DEFAULT_GLASS_LEVEL, glassLevelFrom, type GlassLevel } from "@/lib/glassLevel";

/**
 * BRANCH-ONLY (site/glass): sets `<html data-glass>` from `?glass=subtle|full` once per page load
 * (lib/glassLevel). The pages are static, so the query is read here in the browser, never on the
 * server. The attribute outlives client navigation, so a level picked on one page holds while clicking
 * through. Remove once Design has picked a level.
 */
export function GlassLevelSwitch() {
  useEffect(() => {
    document.documentElement.dataset.glass = glassLevelFrom(window.location.search);
  }, []);
  return null;
}

function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-glass"] });
  return () => observer.disconnect();
}

const readLevel = (): GlassLevel => (document.documentElement.dataset.glass === "subtle" ? "subtle" : DEFAULT_GLASS_LEVEL);
const serverLevel = (): GlassLevel => DEFAULT_GLASS_LEVEL;

/**
 * The current level, for the few places where a level swaps a component rather than a style
 * (Glisse `Input` is full-level only). Everything else switches in glass.css.
 */
export function useGlassLevel(): GlassLevel {
  return useSyncExternalStore(subscribe, readLevel, serverLevel);
}
