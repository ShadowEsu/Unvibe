"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Check, Command, MessageCircle, MousePointer2 } from "lucide-react";

const steps = [
  { id: "select", label: "Select", icon: MousePointer2 },
  { id: "shortcut", label: "⌘U", icon: Command },
  { id: "explain", label: "Explain", icon: MessageCircle },
  { id: "test", label: "Test", icon: Check },
  { id: "keep", label: "Keep", icon: ArrowRight },
] as const;

export function ProductLoop() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const timer = window.setInterval(
      () => setActive((current) => (current + 1) % steps.length),
      2400,
    );
    return () => window.clearInterval(timer);
  }, [paused]);

  return (
    <div
      className="product-loop"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="product-loop__topbar">
        <div><i /><i /><i /></div>
        <span>Unvibe · private review</span>
        <b>⌘U</b>
      </div>
      <div className="product-loop__body">
        <div className={`product-loop__signal product-loop__signal--${active}`} aria-hidden="true">
          <i /><i /><i />
        </div>
        <div className="product-loop__editor" aria-label="Selected TypeScript code">
          <div className="product-loop__file">Editor.tsx</div>
          <pre>
            <code>
              <span className={active >= 0 ? "selected" : ""}>useEffect(() =&gt; {"{"}</span>
              {"\n"}
              <span className={active >= 0 ? "selected" : ""}>  syncDraft(activeId, draft);</span>
              {"\n"}
              <span className={active >= 0 ? "selected" : ""}>{"}"}, [activeId]);</span>
              {"\n\n"}
              <span>return &lt;Editor draft=&#123;draft&#125; /&gt;;</span>
            </code>
          </pre>
          <div className={`product-loop__shortcut ${active >= 1 ? "visible" : ""}`}>
            <kbd>⌘</kbd><kbd>U</kbd>
          </div>
        </div>
        <div className="product-loop__review">
          <div className="review-heading">
            <span>REVIEW</span>
            <b>{active < 2 ? "Reading selection…" : "Effect dependencies"}</b>
          </div>
          <div className={`review-content ${active >= 2 ? "visible" : ""}`}>
            <article>
              <span>WHAT CHANGED</span>
              <p>The draft sync now follows the active document ID.</p>
            </article>
            <article>
              <span>WHY IT MATTERS</span>
              <p>It prevents state from leaking between documents.</p>
            </article>
          </div>
          <div className={`review-question ${active >= 3 ? "visible" : ""}`}>
            <span>QUICK CHECK</span>
            <p>Why should <code>draft</code> also be considered as a dependency?</p>
          </div>
          <div className={`review-actions ${active >= 4 ? "visible" : ""}`}>
            <button type="button">Ask a question</button>
            <button type="button">Test me</button>
            <button type="button" className="primary">I understand</button>
          </div>
        </div>
      </div>
      <div className="product-loop__rail" role="tablist" aria-label="Unvibe review flow">
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <button
              type="button"
              role="tab"
              aria-selected={active === index}
              className={active === index ? "active" : ""}
              key={step.id}
              onClick={() => setActive(index)}
            >
              <Icon size={14} />
              <span>{step.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
