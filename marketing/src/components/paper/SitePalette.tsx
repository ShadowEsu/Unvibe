"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { track } from "@/lib/analytics";
import { BETA_INSTALL_COMMAND, BETA_MAC_DIRECT_DOWNLOAD, BETA_WINDOWS_DIRECT_DOWNLOAD } from "@/lib/betaOffer";

interface Command {
  id: string;
  label: string;
  hint: string;
  keywords?: string;
  run: () => void;
}

/** Substring match first, then a loose in-order letter match so near-misses still land. */
function matches(haystack: string, query: string): boolean {
  if (haystack.includes(query)) return true;
  let i = 0;
  for (const char of haystack) {
    if (char === query[i]) i += 1;
    if (i === query.length) return true;
  }
  return false;
}

/** ⌘K / Ctrl+K palette for jumping around the site. */
export function SitePalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands = useMemo<Command[]>(() => {
    const go = (href: string) => () => router.push(href);
    return [
      { id: "mac", label: "Download for Mac", hint: ".dmg · Apple silicon", keywords: "install get macos apple", run: () => { window.location.href = BETA_MAC_DIRECT_DOWNLOAD; } },
      { id: "win", label: "Download for Windows", hint: ".exe · x64", keywords: "install get pc", run: () => { window.location.href = BETA_WINDOWS_DIRECT_DOWNLOAD; } },
      { id: "copy", label: "Copy the Mac install command", hint: "Terminal", run: () => { void navigator.clipboard?.writeText(BETA_INSTALL_COMMAND).catch(() => undefined); } },
      { id: "home", label: "Home", hint: "/", run: go("/") },
      { id: "demo", label: "Watch the demo", hint: "Product", run: go("/#product") },
      { id: "pricing", label: "Pricing", hint: "Free, Pro, Teams", keywords: "price cost plans pay subscription lifetime", run: go("/pricing") },
      { id: "resources", label: "Resources and guides", hint: "Depths, shortcuts, privacy", run: go("/resources") },
      { id: "help", label: "Installation help", hint: "Sign-in and shortcut fixes", keywords: "support stuck login google windows smartscreen troubleshoot", run: go("/beta#help") },
      { id: "changelog", label: "Change log", hint: "What shipped", run: go("/releases") },
      { id: "growth", label: "Growth", hint: "Building in public", run: go("/build") },
      { id: "privacy", label: "Privacy", hint: "What leaves your machine", keywords: "data security secrets policy", run: go("/privacy") },
      { id: "terms", label: "Terms", hint: "Plain language", run: go("/terms") },
      { id: "email", label: "Email support", hint: "support@unvibe.site", run: () => { window.location.href = "mailto:support@unvibe.site"; } },
    ];
  }, [router]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    const rank = (command: Command): number => {
      const label = command.label.toLowerCase();
      const all = `${label} ${command.hint} ${command.keywords ?? ""}`.toLowerCase();
      if (label.startsWith(q) || label.split(" ").some((word) => word.startsWith(q))) return 0;
      if (all.includes(q)) return 1;
      return matches(all, q) ? 2 : 3;
    };
    return commands
      .map((command) => ({ command, score: rank(command) }))
      .filter((item) => item.score < 3)
      .sort((a, b) => a.score - b.score)
      .map((item) => item.command);
  }, [commands, query]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => {
          if (!value) track("palette_opened", {});
          return !value;
        });
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("unvibe:palette", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("unvibe:palette", onOpen);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActive(0);
    window.setTimeout(() => inputRef.current?.focus(), 10);
  }, [open]);

  useEffect(() => setActive(0), [query]);

  if (!open) return null;

  const runAt = (index: number) => {
    const command = results[index];
    if (!command) return;
    setOpen(false);
    command.run();
  };

  return (
    <div className="palette" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <div className="palette__panel" role="dialog" aria-modal="true" aria-label="Search Unvibe">
        <input
          ref={inputRef}
          className="palette__input"
          placeholder="Jump to a page or download…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setOpen(false);
            else if (event.key === "ArrowDown") { event.preventDefault(); setActive((i) => Math.min(results.length - 1, i + 1)); }
            else if (event.key === "ArrowUp") { event.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
            else if (event.key === "Enter") { event.preventDefault(); runAt(active); }
          }}
          aria-label="Search"
          aria-controls="palette-results"
          aria-activedescendant={results[active] ? `palette-${results[active].id}` : undefined}
        />
        <ul className="palette__list" id="palette-results" role="listbox">
          {results.length === 0 ? <li className="palette__empty">No matches</li> : null}
          {results.map((command, index) => (
            <li
              key={command.id}
              id={`palette-${command.id}`}
              role="option"
              aria-selected={index === active}
              className={index === active ? "is-active" : undefined}
              onMouseEnter={() => setActive(index)}
              onClick={() => runAt(index)}
            >
              <span>{command.label}</span>
              <small>{command.hint}</small>
            </li>
          ))}
        </ul>
        <footer className="palette__foot">
          <span><kbd>↑</kbd><kbd>↓</kbd> move</span>
          <span><kbd>↵</kbd> open</span>
          <span><kbd>esc</kbd> close</span>
        </footer>
      </div>
    </div>
  );
}
