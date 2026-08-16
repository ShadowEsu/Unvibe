"use client";

import { useEffect, useRef, useState } from "react";
import {
  BUILD_MAP_HEIGHT,
  BUILD_MAP_WIDTH,
  buildMapNodes,
  buildMapRoad,
} from "@/data/buildMap";

export function BuildMap() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [drawn, setDrawn] = useState(false);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setDrawn(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setDrawn(true);
        observer.disconnect();
      },
      { threshold: 0.22 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const response = await fetch("/api/build-status", { cache: "no-store" });
        if (!response.ok) return;
        const next = await response.json() as { isLive?: boolean };
        if (alive) setLive(Boolean(next.isLive));
      } catch {
        // Keep the last known live state while the signal reconnects.
      }
    };
    void load();
    const timer = window.setInterval(load, 10_000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <div ref={rootRef} className={drawn ? "paper-map is-drawn" : "paper-map"} aria-label="Product roadmap">
      <svg
        viewBox={`0 0 ${BUILD_MAP_WIDTH} ${BUILD_MAP_HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        <path d={buildMapRoad} className="paper-map__bed" />
        <path d={buildMapRoad} pathLength={1} className="paper-map__lane" />
        <path d={buildMapRoad} className="paper-map__dash" />
      </svg>
      <ol className="paper-map__nodes">
        {buildMapNodes.map((node) => {
          const on = node.id === "liveTesting" && live;
          return (
            <li
              key={node.id}
              className={`paper-map__node is-${node.kind} is-${node.align}${on ? " is-live" : ""}`}
              style={{ left: `${(node.x / BUILD_MAP_WIDTH) * 100}%`, top: `${(node.y / BUILD_MAP_HEIGHT) * 100}%` }}
            >
              <span />
              <strong>{node.label}</strong>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
