"use client";

import { useEffect, useState } from "react";
import type { FaqItem } from "@/data/faq";

export function TypingFaq({ items }: { items: readonly FaqItem[] }) {
  const [openId, setOpenId] = useState("");
  const [typed, setTyped] = useState("");

  useEffect(() => {
    if (!openId) {
      setTyped("");
      return;
    }
    const answer = items.find((item) => item.id === openId)?.answer ?? "";
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setTyped(answer);
      return;
    }
    setTyped("");
    const step = Math.max(12, 2000 / Math.max(answer.length, 1));
    let index = 0;
    const timer = window.setInterval(() => {
      index += 1;
      setTyped(answer.slice(0, index));
      if (index >= answer.length) window.clearInterval(timer);
    }, step);
    return () => window.clearInterval(timer);
  }, [items, openId]);

  return (
    <div className="paper-faq">
      {items.map((item) => {
        const open = item.id === openId;
        return (
          <details
            key={item.id}
            open={open}
            onToggle={(event) => {
              if (event.currentTarget.open) setOpenId(item.id);
              else if (openId === item.id) setOpenId("");
            }}
          >
            <summary>{item.question}</summary>
            <p>
              {open ? typed : ""}
              {open && typed.length < item.answer.length ? <span className="paper-faq__caret" aria-hidden="true" /> : null}
            </p>
          </details>
        );
      })}
    </div>
  );
}
