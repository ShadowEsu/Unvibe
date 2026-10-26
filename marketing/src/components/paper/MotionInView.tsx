"use client";

import { useEffect, useRef, type HTMLAttributes } from "react";
import { observeMotion } from "@/lib/motionInView";

interface MotionInViewProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * Start loading the lazy images inside once this root first comes on screen. For a clipped
   * marquee: lazy images past its overflow edge never intersect, so without this they only load
   * when the animation slides them in.
   */
  eagerImages?: boolean;
}

/** A div whose looping animations pause while it is off-screen (see lib/motionInView). */
export function MotionInView({ eagerImages = false, ...props }: MotionInViewProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const loadImages = () => root.querySelectorAll<HTMLImageElement>('img[loading="lazy"]').forEach((img) => { img.loading = "eager"; });
    return observeMotion(root, eagerImages ? loadImages : undefined);
  }, [eagerImages]);
  return <div ref={ref} {...props} />;
}
