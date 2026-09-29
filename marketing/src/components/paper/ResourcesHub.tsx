"use client";

import { useState } from "react";
import Link from "next/link";
import { useCopyToast } from "@/components/paper/CopyToast";
import { track } from "@/lib/analytics";

type DepthLevel = "new" | "beginner" | "intermediate" | "advanced" | "expert";

const DEPTH_DATA: Record<
  DepthLevel,
  {
    name: string;
    badge: string;
    description: string;
    targetAudience: string;
    sampleExplanation: string;
    keyTakeaway: string;
  }
> = {
  new: {
    name: "New",
    badge: "Level 1 · Conceptual",
    description: "Everyday analogies and clear mental models without overwhelming jargon.",
    targetAudience: "Junior devs, product managers, or engineers encountering a new language.",
    sampleExplanation:
      "Think of this code like a hotel receptionist taking phone reservations:\n\n1. When a new call arrives, the receptionist creates an 'AbortController' — like a buzzer.\n2. If the guest hangs up or calls again before the reservation finishes, the buzzer rings and cancels the in-flight work so the kitchen doesn't make duplicate meals.\n3. Finally, the reservation is stored in memory so future requests for the same room are instant.",
    keyTakeaway: "Prevents race conditions by cancelling superseded requests before storing results in cache.",
  },
  beginner: {
    name: "Beginner",
    badge: "Level 2 · Structural",
    description: "Line-by-line breakdown explaining what each construct and function call accomplishes.",
    targetAudience: "Developers learning modern async TypeScript patterns.",
    sampleExplanation:
      "• Line 2: `new AbortController()` creates a cancellation signal (`controller.signal`).\n• Line 5: `signal.aborted` checks if an earlier call already rendered this obsolete.\n• Line 8: `fetch(url, { signal })` passes the cancellation token to the native HTTP client.\n• Line 12: `cache.set(url, data)` ensures subsequent lookups avoid unnecessary network overhead.\n• Cleanup: `signal.abort()` is called if the component unmounts before response resolves.",
    keyTakeaway: "Clear mapping between language APIs and data flow.",
  },
  intermediate: {
    name: "Intermediate",
    badge: "Level 3 · Architectural",
    description: "Design patterns, stale-while-revalidate caching, and error boundary handling.",
    targetAudience: "Full-stack engineers reviewing PRs and verifying AI agent code.",
    sampleExplanation:
      "This implements an asynchronous Stale-While-Revalidate query cache with cooperative task cancellation:\n\n• Uses AbortController to decouple lifecycle management from HTTP transport, shielding against out-of-order responses.\n• Employs a TTL-bounded in-memory LRU map to throttle API egress.\n• Properly surfaces DOMException ('AbortError') distinct from network failures, preventing false-positive error state triggers in the UI tree.",
    keyTakeaway: "Resilient asynchronous lifecycle with non-blocking revalidation.",
  },
  advanced: {
    name: "Advanced",
    badge: "Level 4 · Systemic",
    description: "Memory footprint, closure scope, event loop timing, and concurrency edge cases.",
    targetAudience: "Senior staff engineers reviewing critical path infrastructure.",
    sampleExplanation:
      "• Closure Retention: The fetch promise holds a strong reference to `controller` until resolution. Ensure short TTLs on failed requests to avoid keeping large lexical contexts alive in GC heap.\n• Microtask Ordering: State updates queued inside the resolved fetch promise run after microtask exhaustion. If invoked during high DOM churning, React 18+ automatic batching combines them safely.\n• Concurrency Window: A tiny TOCTOU gap exists between `cache.has(url)` and the async fetch execution. Recommend keyed promise pooling (single-flight) to deduplicate concurrent requests.",
    keyTakeaway: "Identifies single-flight opportunities and memory leak prevention in long-lived sessions.",
  },
  expert: {
    name: "Expert",
    badge: "Level 5 · Deep Internals",
    description: "V8 engine optimizations, allocation profiles, and runtime memory layout.",
    targetAudience: "Systems engineers, runtime specialists, and compiler enthusiasts.",
    sampleExplanation:
      "• V8 Hidden Classes & Shape: Object properties on the cached response should remain structurally isomorphic. Avoid ad-hoc dynamic property deletion (`delete res.meta`) which deoptimizes transitions to Dictionary Mode.\n• Heap Allocation: `new AbortController()` allocates an internal native Node/Blink wrapper (~128 bytes). In ultra-high-throughput loops (>10k req/s), reuse a static pooled signal or use C-level async hooks.\n• Socket Re-use: Passing `{ keepalive: true }` retains TCP socket connections in the HTTP agent pool across aborted TLS handshakes.",
    keyTakeaway: "Micro-optimization guidelines for zero-deopt V8 execution at scale.",
  },
};

const SHORTCUTS = [
  { mac: "Cmd + Shift + U", win: "Ctrl + Shift + U", action: "Explain selected code in floating Island", context: "Any editor (Cursor, VS Code, Zed, JetBrains)" },
  { mac: "Cmd + Shift + L", win: "Ctrl + Shift + L", action: "Cycle explanation depth (1 → 5)", context: "When explanation card is active" },
  { mac: "Cmd + Shift + T", win: "Ctrl + Shift + T", action: "Test Me (Trigger comprehension quiz)", context: "After reviewing any code explanation" },
  { mac: "Cmd + Shift + S", win: "Ctrl + Shift + S", action: "Save explanation to personal Study dashboard", context: "Saves code + markdown note + citations" },
  { mac: "Cmd + Shift + K", win: "Ctrl + Shift + K", action: "Open Companion App (History, Concepts, Quizzes)", context: "Global desktop shortcut" },
  { mac: "Escape", win: "Escape", action: "Dismiss floating Island / Return to typing", context: "Zero distraction dismissal" },
];

export function ResourcesHub() {
  const [selectedDepth, setSelectedDepth] = useState<DepthLevel>("intermediate");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const { showCopyToast } = useCopyToast();

  const handleCopy = (text: string, key: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    showCopyToast(`Copied ${label}`);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const currentDepth = DEPTH_DATA[selectedDepth];

  return (
    <div className="resources-hub">
      {/* Category Filter Bar */}
      <div className="resources-filters" role="tablist" aria-label="Resource Categories">
        {[
          { id: "all", label: "All Resources" },
          { id: "quickstart", label: "Quickstart" },
          { id: "depths", label: "5 Comprehension Depths" },
          { id: "privacy", label: "Security & Privacy" },
          { id: "shortcuts", label: "Shortcuts & HUD" },
          { id: "brand", label: "Brand Kit" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeCategory === tab.id}
            className={`resources-filter-pill ${activeCategory === tab.id ? "is-active" : ""}`}
            onClick={() => {
              setActiveCategory(tab.id);
              track("code_example_selected", { category: tab.id });
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* SECTION 1: Quickstart & Setup */}
      {(activeCategory === "all" || activeCategory === "quickstart") && (
        <section className="resources-section" id="quickstart">
          <div className="resources-section__head">
            <span className="paper-meta">Onboarding Guide</span>
            <h2>Getting started with Unvibe in under 60 seconds</h2>
            <p className="paper-lead">
              Unvibe runs as a featherweight native desktop overlay. It pairs seamlessly with Cursor, VS Code, or any code editor without invading your git repo.
            </p>
          </div>

          <div className="resources-grid resources-grid--3">
            <div className="resources-card paper-glass">
              <div className="resources-card__step">01</div>
              <h3>Download & Launch</h3>
              <p>
                Grab the DMG for Apple Silicon macOS or the portable EXE for Windows x64. Run the app — it quietly docks to your menu bar or tray.
              </p>
              <div className="resources-card__code">
                <code># Zero npm dependencies, native binaries</code>
              </div>
            </div>

            <div className="resources-card paper-glass">
              <div className="resources-card__step">02</div>
              <h3>Highlight Code in Cursor</h3>
              <p>
                Open your favorite editor. Highlight any complex function, unfamiliar AI generation, or gnarly git diff.
              </p>
              <div className="resources-card__code">
                <code>Cmd + Shift + U (Mac) / Ctrl + Shift + U (Win)</code>
              </div>
            </div>

            <div className="resources-card paper-glass">
              <div className="resources-card__step">03</div>
              <h3>Understand & Retain</h3>
              <p>
                The floating Island displays a clean, syntax-highlighted breakdown. Click <strong>Test Me</strong> to lock the concept into memory.
              </p>
              <div className="resources-card__code">
                <code>Saved to your offline Study log</code>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* SECTION 2: The 5 Depths Interactive Simulator */}
      {(activeCategory === "all" || activeCategory === "depths") && (
        <section className="resources-section" id="depths">
          <div className="resources-section__head">
            <span className="paper-meta">Pedagogy & Intelligence</span>
            <h2>The 5 Depths of Code Comprehension</h2>
            <p className="paper-lead">
              One size never fits all. Whether you need a 30-second intuitive analogy or line-by-line V8 garbage collection analysis, Unvibe dynamically adjusts to your expertise.
            </p>
          </div>

          {/* Interactive Depth Playground */}
          <div className="resources-depth-box paper-glass">
            {/* Depth Selector Pills */}
            <div className="resources-depth-tabs" role="tablist">
              {(Object.keys(DEPTH_DATA) as DepthLevel[]).map((level) => (
                <button
                  key={level}
                  type="button"
                  role="tab"
                  aria-selected={selectedDepth === level}
                  className={`resources-depth-tab ${selectedDepth === level ? "is-active" : ""}`}
                  onClick={() => {
                    setSelectedDepth(level);
                    track("depth_changed", { level });
                  }}
                >
                  <span className="resources-depth-tab__name">{DEPTH_DATA[level].name}</span>
                  <span className="resources-depth-tab__badge">{level === "new" ? "L1" : level === "beginner" ? "L2" : level === "intermediate" ? "L3" : level === "advanced" ? "L4" : "L5"}</span>
                </button>
              ))}
            </div>

            {/* Depth Body */}
            <div className="resources-depth-content">
              <div className="resources-depth-header">
                <div>
                  <span className="resources-depth-badge">{currentDepth.badge}</span>
                  <h3 className="resources-depth-title">{currentDepth.name} Depth Explanation</h3>
                </div>
                <p className="resources-depth-audience">
                  <strong>Best for:</strong> {currentDepth.targetAudience}
                </p>
              </div>

              {/* Sample Code Display */}
              <div className="resources-code-window">
                <div className="resources-code-window__bar">
                  <div className="resources-code-dots">
                    <span />
                    <span />
                    <span />
                  </div>
                  <span className="resources-code-filename">useDeduplicatedQuery.ts</span>
                  <span className="resources-code-lang">TypeScript</span>
                </div>
                <pre className="resources-code-pre">
                  <code>{`export function useDeduplicatedQuery<T>(url: string, ttlMs = 30000) {
  const controller = useRef<AbortController | null>(null);

  return useCallback(async () => {
    controller.current?.abort();
    controller.current = new AbortController();

    const cached = cache.get(url);
    if (cached && Date.now() - cached.timestamp < ttlMs) {
      return cached.data as T;
    }

    const res = await fetch(url, { signal: controller.current.signal });
    const data = await res.json();
    cache.set(url, { data, timestamp: Date.now() });
    return data as T;
  }, [url, ttlMs]);
}`}</code>
                </pre>
              </div>

              {/* Dynamic Explanation Output */}
              <div className="resources-explanation-bubble">
                <div className="resources-explanation-meta">
                  <span className="resources-explanation-indicator" />
                  <strong>Unvibe Output ({currentDepth.name} Level):</strong>
                </div>
                <div className="resources-explanation-text">
                  {currentDepth.sampleExplanation.split("\n\n").map((para, i) => (
                    <p key={i}>{para}</p>
                  ))}
                </div>
                <div className="resources-explanation-takeaway">
                  <strong>Key Learning:</strong> {currentDepth.keyTakeaway}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* SECTION 3: Privacy & Security Architecture */}
      {(activeCategory === "all" || activeCategory === "privacy") && (
        <section className="resources-section" id="privacy">
          <div className="resources-section__head">
            <span className="paper-meta">Zero-Knowledge Guarantee</span>
            <h2>Security & Privacy Architecture</h2>
            <p className="paper-lead">
              AI code review should never leak proprietary company secrets or customer credentials. Unvibe filters all sensitive tokens on your machine before a single byte leaves your hardware.
            </p>
          </div>

          <div className="resources-architecture paper-glass">
            <div className="resources-arch-flow">
              <div className="resources-arch-node">
                <div className="resources-arch-badge">Step 1 · Editor</div>
                <h4>Selected Code</h4>
                <p>Highlighted selection or uncommitted git diff</p>
              </div>

              <div className="resources-arch-arrow">→</div>

              <div className="resources-arch-node resources-arch-node--shield">
                <div className="resources-arch-badge">Step 2 · On-Device</div>
                <h4>Local Secret Filter</h4>
                <p>Regex sweeps for AWS, OpenAI, Stripe, JWT & .env secrets</p>
                <div className="resources-arch-tag">100% On-Device</div>
              </div>

              <div className="resources-arch-arrow">→</div>

              <div className="resources-arch-node">
                <div className="resources-arch-badge">Step 3 · Secure API</div>
                <h4>Sanitized Stream</h4>
                <p>HTTPS SSE streaming via Anthropic Codex (Zero Data Training)</p>
              </div>

              <div className="resources-arch-arrow">→</div>

              <div className="resources-arch-node resources-arch-node--island">
                <div className="resources-arch-badge">Step 4 · Desktop</div>
                <h4>Floating Island</h4>
                <p>Instant syntax-highlighted review card & comprehension quiz</p>
              </div>
            </div>

            <div className="resources-arch-specs">
              <div className="resources-spec-item">
                <strong>Zero Repository Ingestion</strong>
                <p>Unvibe never clones, reads, or indexes your filesystem or repository. Only the explicitly selected snippet is processed.</p>
              </div>
              <div className="resources-spec-item">
                <strong>Zero AI Model Training</strong>
                <p>Under our Anthropic commercial API agreement, inputs and outputs are never retained or utilized for model training.</p>
              </div>
              <div className="resources-spec-item">
                <strong>Client-Side Storage</strong>
                <p>Your notes, flashcards, and history remain encrypted on your local drive in an offline SQLite database.</p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* SECTION 4: Keyboard Shortcuts & Desktop Island Cheatsheet */}
      {(activeCategory === "all" || activeCategory === "shortcuts") && (
        <section className="resources-section" id="shortcuts">
          <div className="resources-section__head">
            <span className="paper-meta">Tactile Workflow</span>
            <h2>Keyboard Shortcuts & Floating Island HUD</h2>
            <p className="paper-lead">
              Designed for keyboard-first developers who live in flow state. Never touch your mouse to understand or quiz AI-generated code.
            </p>
          </div>

          <div className="resources-shortcuts-table paper-glass">
            <div className="resources-table-header">
              <span>Mac</span>
              <span>Windows</span>
              <span>Action</span>
              <span>Context</span>
            </div>
            {SHORTCUTS.map((s, idx) => (
              <div key={idx} className="resources-table-row">
                <span className="resources-key-pill">{s.mac}</span>
                <span className="resources-key-pill">{s.win}</span>
                <span className="resources-action-text">{s.action}</span>
                <span className="resources-context-text">{s.context}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* SECTION 5: Brand & Media Kit */}
      {(activeCategory === "all" || activeCategory === "brand") && (
        <section className="resources-section" id="brand">
          <div className="resources-section__head">
            <span className="paper-meta">Media Kit</span>
            <h2>Brand Assets, Palette & Design Tokens</h2>
            <p className="paper-lead">
              Writing about Unvibe, presenting at a conference, or building an integration? Grab our official vectors, typography standards, and color tokens.
            </p>
          </div>

          <div className="resources-grid resources-grid--2">
            {/* Color Palette */}
            <div className="resources-card paper-glass">
              <h3>Brand Color Tokens</h3>
              <p>Harmonious warm-editorial palette inspired by San Francisco light and crisp paper.</p>
              <div className="resources-swatches">
                {[
                  { name: "Deep Ink", hex: "#0D0F12" },
                  { name: "Coral Bridge", hex: "#E07A5F" },
                  { name: "Pacific Steel", hex: "#3D5A80" },
                  { name: "Paper Bone", hex: "#F4F1DE" },
                  { name: "Mist Veil", hex: "#F8F9FA" },
                ].map((color) => (
                  <button
                    key={color.hex}
                    type="button"
                    className="resources-swatch"
                    onClick={() => handleCopy(color.hex, color.hex, color.name)}
                    title={`Click to copy ${color.hex}`}
                  >
                    <span className="resources-swatch__circle" style={{ backgroundColor: color.hex }} />
                    <span className="resources-swatch__name">{color.name}</span>
                    <code className="resources-swatch__hex">{color.hex}</code>
                  </button>
                ))}
              </div>
            </div>

            {/* Typography & Brand Rules */}
            <div className="resources-card paper-glass">
              <h3>Typography & Voice</h3>
              <div className="resources-typography-guide">
                <div className="resources-type-sample">
                  <span className="resources-type-label">Editorial Serif</span>
                  <p className="resources-serif-demo">Newsreader Italic — Calm, authoritative, editorial.</p>
                </div>
                <div className="resources-type-sample">
                  <span className="resources-type-label">Monospace Code</span>
                  <p className="resources-mono-demo">JetBrains Mono — 13px tabular figures, high legibility.</p>
                </div>
                <div className="resources-type-sample">
                  <span className="resources-type-label">System UI</span>
                  <p className="resources-sans-demo">Inter / SF Pro — Crisp interface chrome and micro-labels.</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Bottom Download CTA Bar */}
      <section className="resources-cta-banner paper-glass">
        <div className="resources-cta-copy">
          <span className="paper-meta">Private Beta</span>
          <h3>Ready to understand the code you ship?</h3>
          <p>Download Unvibe for macOS (Apple Silicon) or Windows (x64) and start your first review.</p>
        </div>
        <div className="resources-cta-actions">
          <Link href="/#install" className="paper-hero__btn-primary">
            Download Unvibe Beta
          </Link>
          <Link href="/pricing" className="paper-text-link">
            View Pro & Teams Pricing →
          </Link>
        </div>
      </section>
    </div>
  );
}
