"use client";

import { useEffect, useRef, type HTMLAttributes } from "react";
import { observeMotion } from "@/lib/motionInView";

/** A div whose looping animations pause while it is off-screen (see lib/motionInView). */
export function MotionInView(props: HTMLAttributes<HTMLDivElement>) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => (ref.current ? observeMotion(ref.current) : undefined), []);
  return <div ref={ref} {...props} />;
}
