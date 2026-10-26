"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Vibe } from "@/components/paper/Vibe";
import { DownloadRow } from "@/components/paper/DownloadLink";
import { GetUnvibe } from "@/components/paper/GetUnvibe";
import { delight } from "@/lib/delight";
import { track } from "@/lib/analytics";
import { detectVisitorDevice } from "@/lib/shortcuts";
import { answerTimeLine } from "@/lib/tryTiming";
import type { DownloadSurface } from "@/lib/downloadTracking";

const API = (process.env.NEXT_PUBLIC_UNVIBE_API ?? "https://api.unvibe.site").replace(/\/$/, "");
const LEVELS = [
  ["new", "New"],
  ["beginner", "Beginner"],
  ["intermediate", "Intermediate"],
  ["advanced", "Advanced"],
  ["expert", "Expert"],
] as const;
type Level = (typeof LEVELS)[number][0];

const SAMPLE = `function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}`;

const NOTES = ["reading your code…", "checking what each line does…", "writing it up for you…"];
const FALLBACK_ERROR = "Vibe could not answer just now.";

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

/** After a failed request: desktop gets the download buttons; a phone can't run the app, so it gets the email link. */
function GetIt({ phone, surface, emailHref }: { phone: boolean; surface: DownloadSurface; emailHref: string }) {
  if (!phone) return <DownloadRow surface={surface} />;
  return (
    <a className="try__phone" href={emailHref} onClick={() => track("email_link_cta_clicked", { surface })}>
      Email me the link
    </a>
  );
}

interface TryItProps {
  /** Code in the editor when the page opens. Default: the debounce sample the home page shows. */
  sample?: string;
  /** File name in the editor's title bar. */
  fileName?: string;
  /** Download surface under a finished answer, for `download_cta_clicked`. */
  answerSurface?: DownloadSurface;
  /** Download surface after a failed request. */
  errorSurface?: DownloadSurface;
  /** Where a phone's "Email me the link" goes after a failed request: the home page's form. */
  emailHref?: string;
}

/**
 * Paste code, pick a depth, get a real explanation from Vibe. Laid out like the desktop
 * panel: depth buttons along the top, the explanation streaming in below. No account.
 * With no props it is the home page's box; /explain pages pass their own sample and surfaces.
 */
export function TryIt({
  sample = SAMPLE,
  fileName = "your-code.js",
  answerSurface = "try_it_answer",
  errorSurface = "try_it",
  emailHref = "#email-link",
}: TryItProps) {
  const [code, setCode] = useState(sample);
  const [level, setLevel] = useState<Level>("intermediate");
  const [state, setState] = useState<"idle" | "thinking" | "done" | "error">("idle");
  const [answer, setAnswer] = useState("");
  const [shown, setShown] = useState("");
  const [error, setError] = useState("");
  const [note, setNote] = useState(0);
  const [phone, setPhone] = useState(false);
  // Request start to the whole answer received, for the last explanation that succeeded.
  const [tookMs, setTookMs] = useState(0);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    setPhone(detectVisitorDevice(navigator.userAgent, navigator.maxTouchPoints) === "phone");
  }, []);

  useEffect(() => {
    if (state !== "thinking") return;
    setNote(0);
    const id = window.setInterval(() => setNote((n) => Math.min(NOTES.length - 1, n + 1)), 1300);
    return () => window.clearInterval(id);
  }, [state]);

  // Reveal the answer a few characters at a time so it feels like Vibe is writing.
  useEffect(() => {
    if (!answer) { setShown(""); return; }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(answer);
      return;
    }
    let i = 0;
    const step = () => {
      i = Math.min(answer.length, i + 6);
      setShown(answer.slice(0, i));
      if (i < answer.length) timer.current = window.setTimeout(step, 14);
    };
    step();
    return () => { if (timer.current) window.clearTimeout(timer.current); };
  }, [answer]);

  const explain = async (depth: Level = level) => {
    setState("thinking");
    setError("");
    setAnswer("");
    setTookMs(0);
    const started = performance.now();
    try {
      const response = await fetch(`${API}/api/v1/try`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, level: depth }),
      });
      const body = (await response.json().catch(() => ({}))) as { text?: string; error?: string };
      if (!response.ok || !body.text) throw new Error(body.error || FALLBACK_ERROR);
      // The body is read in full above, so this is the moment the last of the answer arrived.
      setTookMs(performance.now() - started);
      setAnswer(body.text);
      setState("done");
      delight();
      track("try_explained", { level: depth });
    } catch (reason) {
      setState("error");
      setError(reason instanceof Error ? reason.message : FALLBACK_ERROR);
    }
  };

  // Like the app: switching depth after an answer explains the same code again at that depth.
  const pickLevel = (next: Level) => {
    if (next === level) return;
    setLevel(next);
    if (state === "done") void explain(next);
  };

  const onEditorKey = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && state !== "thinking" && code.trim()) {
      event.preventDefault();
      void explain();
    }
  };

  const lines = code ? code.split("\n").length : 0;
  const writing = state === "done" && shown.length < answer.length;
  const status =
    state === "thinking" ? "Vibe is thinking." : state === "error" ? error : state === "done" && !writing ? "Explanation ready." : "";
  const depthLabel = LEVELS.find(([id]) => id === level)?.[1] ?? "";
  const timeLine = answerTimeLine(tookMs);

  return (
    <div className="try">
      <div className="try__editor">
        <div className="try__bar"><i /><i /><i /><span>{fileName}</span></div>
        <label className="sr-only" htmlFor="try-code">Code to explain</label>
        <textarea
          id="try-code"
          aria-describedby="try-fine"
          spellCheck={false}
          wrap="off"
          value={code}
          maxLength={1500}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={onEditorKey}
        />
        <div className="try__foot">
          <button type="button" className="try__go" disabled={state === "thinking" || !code.trim()} onClick={() => void explain()}>
            {state === "thinking" ? "Vibe is thinking…" : `Explain it · ${depthLabel}`}
          </button>
          <p className="try__fine" id="try-fine">Up to 60 lines. Keys and passwords are blocked.</p>
        </div>
      </div>

      <div className="try__panel">
        <div className="try__head">
          <Vibe size={34} follow={false} />
          <p><b>Vibe</b><span>{lines} {lines === 1 ? "line" : "lines"} selected</span></p>
        </div>
        <div className="try__levels" role="group" aria-label="Explanation depth">
          {LEVELS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={level === id}
              disabled={state === "thinking"}
              onClick={() => pickLevel(id)}
            >
              {label}
              {id === "expert" ? <small>Pro<span className="sr-only"> in the app</span></small> : null}
            </button>
          ))}
        </div>
        <p className="sr-only" role="status">{status}</p>
        <div className="try__body">
          {state === "idle" ? (
            <div className="try__state">
              <Vibe size={72} />
              <p>Press <b>Explain it</b> for the sample, or paste your own code first.</p>
            </div>
          ) : state === "thinking" ? (
            <div className="try__state try__state--thinking" aria-hidden="true">
              <span className="try__bob"><Vibe size={60} follow={false} /></span>
              <p key={note}>{NOTES[note]}</p>
              <i /><i /><i />
            </div>
          ) : state === "error" ? (
            <div className="try__state">
              <Vibe size={60} follow={false} />
              <p className="try__error">{error}</p>
              <button type="button" className="try__retry" onClick={() => void explain()}>Try again</button>
              <GetIt phone={phone} surface={errorSurface} emailHref={emailHref} />
            </div>
          ) : (
            <div className="try__answer">
              <div dangerouslySetInnerHTML={{ __html: render(shown) }} />
              {writing ? null : (
                <div className="try__after">
                  {timeLine ? <p className="try__took">{timeLine}</p> : null}
                  <GetUnvibe surface={answerSurface} />
                  <p className="try__again">Pick another depth above to explain it again. The app does this beside your editor, free.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
