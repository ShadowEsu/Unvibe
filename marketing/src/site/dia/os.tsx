"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { detectVisitorDevice, type VisitorDevice } from "@/lib/shortcuts";
import { applyOsClasses } from "./osBoot";

const useBeforePaint = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** Client navigation runs no inline script, so a page reached by a link sets the OS classes before it paints. */
export function OsClass() {
  useBeforePaint(applyOsClasses, []);
  return null;
}

/** The visitor's computer for components that need it in state (the server and first render assume a Mac). */
export function useVisitor(): { device: VisitorDevice; known: boolean } {
  const [visitor, setVisitor] = useState<{ device: VisitorDevice; known: boolean }>({ device: "mac", known: false });
  useEffect(() => {
    const forced = new URLSearchParams(window.location.search).get("os");
    const device = forced === "win" ? "windows" : forced === "mac" ? "mac" : detectVisitorDevice(navigator.userAgent, navigator.maxTouchPoints);
    setVisitor({ device, known: true });
  }, []);
  return visitor;
}
