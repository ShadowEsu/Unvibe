"use client";

import { useEffect, useRef, useState } from "react";
import { Vibe } from "@/components/paper/Vibe";
import { DownloadRow } from "@/components/paper/DownloadLink";
import { delight } from "@/lib/delight";
import { track } from "@/lib/analytics";

const API = (process.env.NEXT_PUBLIC_UNVIBE_API ?? "https://api.unvibe.site").replace(/\/$/, "");
const LEVELS = [
  ["new", "New"],
  ["beginner", "Beginner"],
  ["intermediate", "Intermediate"],
  ["advanced", "Advanced"],
  ["expert", "Expert"],
] as const;

const SAMPLE = `function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}`;

const NOTES = ["hmm, reading your code…", "checking what each line does…", "writing it up for you…"];

/** Turn the model's light markdown into safe HTML: escape first, then bold, code and bullets. */
function render(text: string): string {
  const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const inline = (line: string) =>
    line.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/`([^`]+)`/g, "<code>$1</code>");
  const out: string[] = [];
  let list = false;
  for (const raw of escaped.split("\n")) {
    const line = raw.trim();
    const bullet = /^[*-]\s+(.*)$/.exec(line);
    if (bullet) {
      if (!list) { out.push("<ul>"); list = true; }
      out.push(`<li>${inline(bullet[1] ?? "")}</li>`);
      continue;
    }
    if (list) { out.push("</ul>"); list = false; }
    if (line) out.push(`<p>${inline(line)}</p>`);
  }
  if (list) out.push("</ul>");
  return out.join("");
}

/** Paste code, pick a depth, get a real explanation from Vibe. Strictly limited, no account. */
export function TryIt() {
  const [code, setCode] = useState(SAMPLE);
  const [level, setLevel] = useState<(typeof LEVELS)[number][0]>("intermediate");
  const [state, setState] = useState<"idle" | "thinking" | "done" | "error">("idle");
  const [answer, setAnswer] = useState("");
  const [shown, setShown] = useState("");
  const [error, setError] = useState("");
  const [note, setNote] = useState(0);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (state !== "thinking") return;
    setNote(0);
    const id = window.setInterval(() => setNote((n) => Math.min(NOTES.length - 1, n + 1)), 1300);
    return () => window.clearInterval(id);
  }, [state]);

  // Reveal the answer a few characters at a time so it feels like Vibe is writing.
  useEffect(() => {
    if (!answer) { setShown(""); return; }
    let i = 0;
    const step = () => {
      i = Math.min(answer.length, i + 6);
      setShown(answer.slice(0, i));
      if (i < answer.length) timer.current = window.setTimeout(step, 14);
    };
    step();
    return () => { if (timer.current) window.clearTimeout(timer.current); };
  }, [answer]);

  const explain = async () => {
    setState("thinking");
    setError("");
    setAnswer("");
    try {
      const response = await fetch(`${API}/api/v1/try`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, level }),
      });
      const body = (await response.json().catch(() => ({}))) as { text?: string; error?: string };
      if (!response.ok || !body.text) throw new Error(body.error || "Vibe could not answer just now.");
      setAnswer(body.text);
      setState("done");
      delight();
      track("try_explained", { level });
    } catch (reason) {
      setState("error");
      setError(reason instanceof Error ? reason.message : "Vibe could not answer just now.");
    }
  };

  return (
    <div className="try">
      <div className="try__input">
        <div className="try__bar"><i /><i /><i /><span>your-code.js</span></div>
        <textarea
          aria-label="Code to explain"
          spellCheck={false}
          value={code}
          maxLength={1500}
          onChange={(e) => setCode(e.target.value)}
        />
        <div className="try__levels" role="radiogroup" aria-label="Depth">
          {LEVELS.map(([id, label]) => (
            <button key={id} type="button" role="radio" aria-checked={level === id} className={level === id ? "is-on" : ""} onClick={() => setLevel(id)}>
              {label}
            </button>
          ))}
        </div>
        <button type="button" className="try__go" disabled={state === "thinking" || !code.trim()} onClick={() => void explain()}>
          {state === "thinking" ? "Vibe is thinking…" : "Explain it ⌘U"}
        </button>
        <p className="try__fine">Small snippets only. Do not paste keys or passwords; we block them anyway.</p>
      </div>
      <div className="try__output" aria-live="polite">
        {state === "idle" ? (
          <div className="try__empty"><Vibe size={84} /><p>Paste any code on the left and press <b>Explain it</b>.</p></div>
        ) : state === "thinking" ? (
          <div className="try__thinking"><span className="try__bob"><Vibe size={70} follow={false} /></span><p key={note}>{NOTES[note]}</p><i /><i /><i /></div>
        ) : state === "error" ? (
          <div className="try__empty"><Vibe size={70} /><p className="try__error">{error}</p><DownloadRow /></div>
        ) : (
          <div className="try__answer">
            <div dangerouslySetInnerHTML={{ __html: render(shown) }} />
            {shown.length >= answer.length ? (
              <div className="try__after">
                <p>Like that? It does this right beside your editor, for free.</p>
                <DownloadRow />
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
