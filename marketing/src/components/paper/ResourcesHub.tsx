"use client";

import { useState } from "react";
import Link from "next/link";
import { useCopyToast } from "@/components/paper/CopyToast";
import { DownloadRow } from "@/components/paper/DownloadLink";
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
    badge: "Depth 1 · Concepts",
    description: "Everyday analogies and clear mental models without overwhelming jargon.",
    targetAudience: "Junior devs, product managers, or engineers encountering a new language.",
    sampleExplanation:
      "Think of this code like a hotel receptionist taking phone reservations:\n\n1. When a new call arrives, the receptionist creates an 'AbortController' — like a buzzer.\n2. If the guest hangs up or calls again before the reservation finishes, the buzzer rings and cancels the in-flight work so the kitchen doesn't make duplicate meals.\n3. Finally, the reservation is stored in memory so future requests for the same room are instant.",
    keyTakeaway: "Prevents race conditions by cancelling superseded requests before storing results in cache.",
  },
  beginner: {
    name: "Beginner",
    badge: "Depth 2 · Structure",
    description: "Line-by-line breakdown explaining what each construct and function call accomplishes.",
    targetAudience: "Developers learning modern async TypeScript patterns.",
    sampleExplanation:
      "• Line 2: `new AbortController()` creates a cancellation signal (`controller.signal`).\n• Line 5: `signal.aborted` checks if an earlier call already rendered this obsolete.\n• Line 8: `fetch(url, { signal })` passes the cancellation token to the native HTTP client.\n• Line 12: `cache.set(url, data)` ensures subsequent lookups avoid unnecessary network overhead.\n• Cleanup: `signal.abort()` is called if the component unmounts before response resolves.",
    keyTakeaway: "Clear mapping between language APIs and data flow.",
  },
  intermediate: {
    name: "Intermediate",
    badge: "Depth 3 · Design",
    description: "Design patterns, stale-while-revalidate caching, and error boundary handling.",
    targetAudience: "Full-stack engineers reviewing PRs and verifying AI agent code.",
    sampleExplanation:
      "This implements an asynchronous Stale-While-Revalidate query cache with cooperative task cancellation:\n\n• Uses AbortController to decouple lifecycle management from HTTP transport, shielding against out-of-order responses.\n• Employs a TTL-bounded in-memory LRU map to throttle API egress.\n• Properly surfaces DOMException ('AbortError') distinct from network failures, preventing false-positive error state triggers in the UI tree.",
    keyTakeaway: "Resilient asynchronous lifecycle with non-blocking revalidation.",
  },
  advanced: {
    name: "Advanced",
    badge: "Depth 4 · Systems",
    description: "Memory footprint, closure scope, event loop timing, and concurrency edge cases.",
    targetAudience: "Senior staff engineers reviewing critical path infrastructure.",
    sampleExplanation:
      "• Closure Retention: The fetch promise holds a strong reference to `controller` until resolution. Ensure short TTLs on failed requests to avoid keeping large lexical contexts alive in GC heap.\n• Microtask Ordering: State updates queued inside the resolved fetch promise run after microtask exhaustion. If invoked during high DOM churning, React 18+ automatic batching combines them safely.\n• Concurrency Window: A tiny TOCTOU gap exists between `cache.has(url)` and the async fetch execution. Recommend keyed promise pooling (single-flight) to deduplicate concurrent requests.",
    keyTakeaway: "Identifies single-flight opportunities and memory leak prevention in long-lived sessions.",
  },
  expert: {
    name: "Expert",
    badge: "Depth 5 · Internals",
    description: "V8 engine optimizations, allocation profiles, and runtime memory layout.",
    targetAudience: "Systems engineers, runtime specialists, and compiler enthusiasts.",
    sampleExplanation:
      "• V8 Hidden Classes & Shape: Object properties on the cached response should remain structurally isomorphic. Avoid ad-hoc dynamic property deletion (`delete res.meta`) which deoptimizes transitions to Dictionary Mode.\n• Heap Allocation: `new AbortController()` allocates an internal native Node/Blink wrapper (~128 bytes). In ultra-high-throughput loops (>10k req/s), reuse a static pooled signal or use C-level async hooks.\n• Socket Re-use: Passing `{ keepalive: true }` retains TCP socket connections in the HTTP agent pool across aborted TLS handshakes.",
    keyTakeaway: "Micro-optimization guidelines for zero-deopt V8 execution at scale.",
  },
};

const SHORTCUTS = [
  { mac: "\u2318 U", win: "Ctrl U", action: "Explain the selected code", context: "Cursor and VS Code, through the Unvibe editor bridge" },
  { mac: "Control U", win: "Ctrl U", action: "Explain the selected code", context: "Any other app. You can change this shortcut in Settings" },
  { mac: "Escape", win: "Escape", action: "Collapse the explanation card", context: "While a card is focused" },
];

export function ResourcesHub() {
  const [selectedDepth, setSelectedDepth] = useState<DepthLevel>("intermediate");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const { showCopyToast } = useCopyToast();

  const handleCopy = async (text: string, key: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      showCopyToast("Copy failed. Select the value and copy it yourself.");
      return;
    }
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
          { id: "all", label: "All" },
          { id: "quickstart", label: "Quickstart" },
          { id: "depths", label: "Depths" },
          { id: "privacy", label: "Privacy" },
          { id: "shortcuts", label: "Shortcuts" },
          { id: "brand", label: "Brand" },
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
            <span className="paper-meta">Quickstart</span>
            <h2>Get started in about a minute</h2>
            <p className="paper-lead">
              Unvibe is a desktop overlay that sits beside Cursor, VS Code, or any app where you can select code. It reads only what you select and never touches your git repo.
            </p>
          </div>

          <div className="resources-grid resources-grid--3">
            <div className="resources-card paper-glass">
              <div className="resources-card__step">01</div>
              <h3>Download & Launch</h3>
              <p>
                Grab the .dmg for Apple silicon Macs or the portable .exe for Windows x64. Open the app and it waits in your menu bar or tray.
              </p>
              <div className="resources-card__code">
                <code>Mac: Apple silicon .dmg &middot; Windows: x64 portable .exe</code>
              </div>
            </div>

            <div className="resources-card paper-glass">
              <div className="resources-card__step">02</div>
              <h3>Highlight Code in Cursor</h3>
              <p>
                Open your favorite editor. Highlight any complex function, unfamiliar AI generation, or gnarly git diff.
              </p>
              <div className="resources-card__code">
                <code>&#8984;U on Mac &middot; Ctrl+U on Windows</code>
              </div>
            </div>

            <div className="resources-card paper-glass">
              <div className="resources-card__step">03</div>
              <h3>Understand & Retain</h3>
              <p>
                The floating Island displays a clean, syntax-highlighted breakdown. Click <strong>Test me</strong> to check what stuck.
              </p>
              <div className="resources-card__code">
                <code>Saved on your device in Study</code>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* SECTION 2: The 5 Depths Interactive Simulator */}
      {(activeCategory === "all" || activeCategory === "depths") && (
        <section className="resources-section" id="depths">
          <div className="resources-section__head">
            <span className="paper-meta">Explanation depths</span>
            <h2>Five explanation depths</h2>
            <p className="paper-lead">
              The same code, explained five ways. Pick the depth that matches what you already know. The sample below is written by hand to show the range. It is not live model output.
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
                  <h3 className="resources-depth-title">{currentDepth.name} depth</h3>
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
                  <strong>Example, {currentDepth.name} depth:</strong>
                </div>
                <div className="resources-explanation-text">
                  {currentDepth.sampleExplanation.split("\n\n").map((para, i) => (
                    <p key={i}>{para}</p>
                  ))}
                </div>
                <div className="resources-explanation-takeaway">
                  <strong>Takeaway:</strong> {currentDepth.keyTakeaway}
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
            <span className="paper-meta">What leaves your machine</span>
            <h2>How your code is handled</h2>
            <p className="paper-lead">
              Unvibe is not a local-only tool. Your selected code is sent to a cloud model to write the explanation. A secret scanner runs on your machine first, and anything that looks like a key or token is blocked or held for your confirmation.
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
                <h4>Local secret scan</h4>
                <p>Pattern checks for cloud keys, API tokens, private keys, and risky assignments</p>
                <div className="resources-arch-tag">Runs on-device</div>
              </div>

              <div className="resources-arch-arrow">→</div>

              <div className="resources-arch-node">
                <div className="resources-arch-badge">Step 3 · Cloud model</div>
                <h4>Filtered snippet</h4>
                <p>Sent over HTTPS to the model provider, and the answer streams back</p>
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
                <strong>No repository upload</strong>
                <p>Unvibe does not clone or index your repository. It sends the code you select plus limited context such as file name and language.</p>
              </div>
              <div className="resources-spec-item">
                <strong>No training set built from your code</strong>
                <p>Unvibe does not build a training set from your code. Provider retention follows the provider’s API terms, described on the <Link href="/privacy" className="paper-text-link">privacy page</Link>.</p>
              </div>
              <div className="resources-spec-item">
                <strong>Local history</strong>
                <p>Saved explanations, notes, and quiz history live on your device. Your sign-in token is sealed with the OS keychain. Optional sync stores learning metadata, not your code.</p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* SECTION 4: Keyboard Shortcuts & Desktop Island Cheatsheet */}
      {(activeCategory === "all" || activeCategory === "shortcuts") && (
        <section className="resources-section" id="shortcuts">
          <div className="resources-section__head">
            <span className="paper-meta">Shortcuts</span>
            <h2>Keyboard shortcuts</h2>
            <p className="paper-lead">
              One shortcut starts a review. Everything after that works from the keyboard too.
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

      {/* SECTION 5: Brand & Brand */}
      {(activeCategory === "all" || activeCategory === "brand") && (
        <section className="resources-section" id="brand">
          <div className="resources-section__head">
            <span className="paper-meta">Brand</span>
            <h2>Brand colors and type</h2>
            <p className="paper-lead">
              Writing about Unvibe? Copy the colors below and use the fonts as listed.
            </p>
          </div>

          <div className="resources-grid resources-grid--2">
            {/* Color Palette */}
            <div className="resources-card paper-glass">
              <h3>Colors</h3>
              <p>The colors used on this site and in the app.</p>
              <div className="resources-swatches">
                {[
                  { name: "Ink", hex: "#12110F" },
                  { name: "Paper", hex: "#F3EEF8" },
                  { name: "Hero white", hex: "#F7F4EE" },
                  { name: "Violet", hex: "#6F45D2" },
                  { name: "Deep violet", hex: "#3D2080" },
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
              <h3>Type</h3>
              <div className="resources-typography-guide">
                <div className="resources-type-sample">
                  <span className="resources-type-label">Editorial Serif</span>
                  <p className="resources-serif-demo">Newsreader Italic. Calm and editorial.</p>
                </div>
                <div className="resources-type-sample">
                  <span className="resources-type-label">Monospace Code</span>
                  <p className="resources-mono-demo">JetBrains Mono for code and shortcuts.</p>
                </div>
                <div className="resources-type-sample">
                  <span className="resources-type-label">System UI</span>
                  <p className="resources-sans-demo">Inter for interface text and small labels.</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Bottom Download CTA Bar */}
      <section className="resources-cta-banner paper-glass">
        <div className="resources-cta-copy">
          <span className="paper-meta">Free during the beta</span>
          <h3>Ready to understand the code you ship?</h3>
          <p>Download Unvibe for Mac (Apple silicon) or Windows (x64) and run your first review.</p>
        </div>
        <div className="resources-cta-actions">
          <DownloadRow href="/beta" />
          <Link href="/pricing" className="paper-text-link">
            See pricing
          </Link>
        </div>
      </section>
    </div>
  );
}
