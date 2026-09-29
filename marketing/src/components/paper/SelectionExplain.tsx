"use client";

import { useEffect, useRef, useState } from "react";
import { track } from "@/lib/analytics";

interface Card {
  text: string;
  x: number;
  y: number;
}

const MAX_QUOTE = 90;

/**
 * Easter egg: select text anywhere on the site and press ⌘U / Ctrl+U to see the
 * gesture Unvibe uses in your editor. Nothing is sent anywhere.
 */
export function SelectionExplain() {
  const [card, setCard] = useState<Card | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setCard(null);
        return;
      }
      const combo = (event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "u";
      if (!combo) return;
      const target = event.target;
      if (target instanceof Element && target.closest("input, textarea, [contenteditable='true']")) return;
      const selection = window.getSelection();
      const text = selection?.toString().trim() ?? "";
      if (!selection || !text || selection.rangeCount === 0) return;
      event.preventDefault();
      const rect = selection.getRangeAt(0).getBoundingClientRect();
      const width = Math.min(340, window.innerWidth - 24);
      const x = Math.min(Math.max(12, rect.left + rect.width / 2 - width / 2), window.innerWidth - width - 12);
      const below = rect.bottom + 14;
      const y = below + 220 > window.innerHeight ? Math.max(12, rect.top - 234) : below;
      setCard({ text: text.length > MAX_QUOTE ? `${text.slice(0, MAX_QUOTE)}…` : text, x, y });
      track("selection_explain_tried", { length: text.length });
    };
    const onPointer = (event: PointerEvent) => {
      if (cardRef.current && !cardRef.current.contains(event.target as Node)) setCard(null);
    };
    const onScroll = () => setCard(null);
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  if (!card) return null;

  return (
    <div
      ref={cardRef}
      className="sel-card"
      role="dialog"
      aria-label="Unvibe preview"
      style={{ left: card.x, top: card.y }}
    >
      <header>
        <span className="sel-card__logo" aria-hidden="true" />
        <strong>Unvibe</strong>
        <kbd>{typeof navigator !== "undefined" && /Win/i.test(navigator.userAgent) ? "Ctrl U" : "⌘ U"}</kbd>
      </header>
      <blockquote>&ldquo;{card.text}&rdquo;</blockquote>
      <p>
        That is the gesture. In Cursor or VS Code, this opens a plain-English explanation of the code you
        selected, right beside your editor.
      </p>
      <a href="/beta" className="sel-card__cta">Try it on real code →</a>
    </div>
  );
}
