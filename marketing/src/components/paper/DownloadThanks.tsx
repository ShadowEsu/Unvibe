"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type RefObject } from "react";
import { MacDownloads } from "@/components/paper/thanks-art/MacDownloads";
import { MacDrag } from "@/components/paper/thanks-art/MacDrag";
import { MacOpenAnyway } from "@/components/paper/thanks-art/MacOpenAnyway";
import { WinKeep } from "@/components/paper/thanks-art/WinKeep";
import { WinRun } from "@/components/paper/thanks-art/WinRun";
import { WinRunAnyway } from "@/components/paper/thanks-art/WinRunAnyway";
import { downloadSurface, thanksOs, trackDownloadClick, trackDownloadThanksViewed, type ThanksOs } from "@/lib/downloadTracking";
import {
  THANKS_DOWNLOADS,
  takeThanksToken,
  thanksHref,
  thanksSteps,
  type ThanksScene,
  type ThanksSegment,
  type ThanksStep,
} from "@/lib/downloadThanks";
import { observeMotion } from "@/lib/motionInView";
import { visitorInstallOs } from "@/lib/shortcuts";

/** ready: no fresh click token, so nothing downloads by itself. preparing → started: the page asks for the file. */
export type ThanksState = "ready" | "preparing" | "started";

const PILL: Readonly<Record<ThanksState, string>> = {
  ready: "Ready to download",
  preparing: "Preparing download",
  started: "Download started",
};

const SCENES: Readonly<Record<ThanksScene, () => JSX.Element>> = {
  "mac-downloads": MacDownloads,
  "mac-drag": MacDrag,
  "mac-open-anyway": MacOpenAnyway,
  "win-keep": WinKeep,
  "win-run": WinRun,
  "win-run-anyway": WinRunAnyway,
};

/** After the first paint, so the page is on screen before the browser shows its download. */
const START_DELAY_MS = 400;
/** The step grid fades out this long before the OS switch swaps it. */
const SWITCH_EXIT_MS = 120;

function Spinner() {
  return (
    <svg className="thanks__spin" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
      <circle className="thanks__spin-track" cx="6" cy="6" r="4.5" fill="none" strokeWidth="1.6" />
      <path className="thanks__spin-arc" d="M6 1.5a4.5 4.5 0 0 1 4.5 4.5" fill="none" strokeWidth="1.6" strokeLinecap="round" />
      <circle className="thanks__spin-dot" cx="6" cy="6" r="2.5" />
    </svg>
  );
}

function Check() {
  return (
    <svg viewBox="0 0 12 12" aria-hidden="true" focusable="false">
      <circle cx="6" cy="6" r="6" fill="#141414" />
      <path d="M3.4 6.2l1.7 1.7 3.5-3.6" fill="none" stroke="#d6f45a" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function StepCard({ step, number, captionRef }: { step: ThanksStep; number: number; captionRef?: RefObject<HTMLParagraphElement> }) {
  const art = useRef<HTMLDivElement>(null);
  // One short cue the first time the card is on screen (CSS plays it on data-cue), then it holds.
  useEffect(() => {
    const node = art.current;
    return node ? observeMotion(node, () => { node.dataset.cue = "on"; }) : undefined;
  }, []);
  const Art = SCENES[step.scene];
  return (
    <li className="thanks__step thanks__in">
      <span className="thanks__num" aria-hidden="true">{number}</span>
      <div className="thanks__card">
        <div ref={art} className={`thanks__art thanks__art--${number}`}>
          <Art />
        </div>
        <p className="thanks__cap" ref={captionRef} tabIndex={captionRef ? -1 : undefined}>
          {step.caption.map((part: ThanksSegment, i) => (typeof part === "string" ? part : <b key={i}>{part.b}</b>))}
        </p>
      </div>
    </li>
  );
}

export interface ThanksContentProps {
  os: ThanksOs;
  state: ThanksState;
  /** False until the client has read the click token; with JS, the content stays hidden until then. */
  decided?: boolean;
  leaving?: boolean;
  switched?: boolean;
  firstCaptionRef?: RefObject<HTMLParagraphElement>;
  /** A click on a link to one of the files. */
  onFile?: (os: ThanksOs) => void;
  onSwitch?: () => void;
}

/** Everything under the mark, for one file and one state. Every name and link comes from THANKS_DOWNLOADS. */
export function ThanksContent({ os, state, decided = false, leaving = false, switched = false, firstCaptionRef, onFile, onSwitch }: ThanksContentProps) {
  const { href } = THANKS_DOWNLOADS[os];
  const mac = os !== "windows";
  // Every link to a file on this page is a download click, surface "thanks"; the browser downloads it in place.
  const file = (target: ThanksOs) => () => {
    trackDownloadClick("thanks", target === "windows" ? "windows" : "mac");
    onFile?.(target);
  };
  const manual = (
    <a className="thanks__link thanks__nowrap" href={href} onClick={file(os)}>download Unvibe manually</a>
  );
  const preparingLine = (link: JSX.Element) => <>Your download will begin automatically. If it didn&apos;t start, {link}.</>;
  const startedLine = (link: JSX.Element) => <>Your download has started. If it didn&apos;t, {link}.</>;
  const ghostLink = <span className="thanks__nowrap">download Unvibe manually</span>;
  const buttonLabel = mac ? "Download Unvibe for Mac" : "Download Unvibe for Windows";
  return (
    <section className="thanks" aria-labelledby="thanks-title" data-view={decided ? state : undefined} data-switched={switched || undefined}>
      <p className="thanks__pill thanks__in" role="status" aria-live="polite" data-state={state}>
        <span className="sr-only">{PILL[state]}</span>
        {/* All three faces share one grid cell, so the pill keeps one width in every state (CLS 0). */}
        <span className="thanks__pill-face" aria-hidden="true">
          <span className="thanks__pill-layer" data-on={state === "ready" ? "" : undefined}>{PILL.ready}</span>
          <span className="thanks__pill-layer" data-on={state === "preparing" ? "" : undefined}><Spinner />{PILL.preparing}</span>
          <span className="thanks__pill-layer" data-on={state === "started" ? "" : undefined}><Check />{PILL.started}</span>
        </span>
      </p>

      <h1 id="thanks-title" className="thanks__title thanks__in">
        Thanks for downloading Unvibe.<br /> <span>Just a few steps left.</span>
      </h1>

      <div className="thanks__lead thanks__in">
        {/* The shown line and hidden copies of the other two share one grid cell, so swapping the state
            never moves the steps below it (CLS 0). The copies hold no links and are hidden from everyone. */}
        <div className="thanks__slot">
          {state === "ready" ? (
            <a className="paper-join paper-join--win thanks__primary" href={href} onClick={file(os)}>
              <span className="paper-join__label">{buttonLabel}</span>
            </a>
          ) : (
            <p className="thanks__line">{state === "preparing" ? preparingLine(manual) : startedLine(manual)}</p>
          )}
          <div className="thanks__ghost" aria-hidden="true">
            {state !== "ready" ? <span className="paper-join thanks__primary"><span className="paper-join__label">{buttonLabel}</span></span> : null}
            {state !== "preparing" ? <p className="thanks__line">{preparingLine(ghostLink)}</p> : null}
            {state !== "started" ? <p className="thanks__line">{startedLine(ghostLink)}</p> : null}
          </div>
        </div>
        {os === "mac" ? (
          <p className="thanks__sub">
            Intel Mac? <a className="thanks__link" href={THANKS_DOWNLOADS["mac-intel"].href} onClick={file("mac-intel")}>Get the Intel build</a>.
          </p>
        ) : os === "mac-intel" ? (
          <p className="thanks__sub">
            M1 or newer? <a className="thanks__link" href={THANKS_DOWNLOADS.mac.href} onClick={file("mac")}>Get that build instead</a>.
          </p>
        ) : null}
        {mac ? (
          <noscript>
            <p className="thanks__sub">
              On Windows? <a className="thanks__link" href={THANKS_DOWNLOADS.windows.href}>Download Unvibe for Windows</a>.
            </p>
          </noscript>
        ) : null}
      </div>

      {/* Keyed by system, not file: the Intel build swaps only the name in step 1. */}
      <ol key={mac ? "mac" : "windows"} className="thanks__steps" aria-label={mac ? "Steps for Mac" : "Steps for Windows"} data-leaving={leaving || undefined}>
        {thanksSteps(os).map((step, i) => (
          <StepCard key={step.scene} step={step} number={i + 1} captionRef={i === 0 ? firstCaptionRef : undefined} />
        ))}
      </ol>

      <button type="button" className="thanks__switch thanks__in" onClick={onSwitch}>
        {mac ? "Show the Windows steps" : "Show the Mac steps"}
      </button>
      <p className="thanks__trouble thanks__in">
        Having trouble with the installer? <Link className="thanks__link" href="/install-help?from=thanks">Read install help</Link> or{" "}
        <a className="thanks__link" href={href} onClick={file(os)}>download the file directly</a>.
      </p>
    </section>
  );
}

/**
 * /download/thanks. On load it maps `?os=` and `?from=` through the downloadTracking allowlists,
 * takes the one-time click token, and only for a fresh token for that same file asks for the file,
 * 400 ms after the first paint. Without a token it offers the download as a button instead.
 *
 * `initialOs` is the server's answer to the same question (the allowlisted `?os=`, else the user
 * agent), so the first render already shows the right system and nothing moves on hydration.
 */
export function DownloadThanks({ initialOs }: { initialOs: ThanksOs }) {
  const [os, setOs] = useState<ThanksOs>(initialOs);
  const [state, setState] = useState<ThanksState>("ready");
  const [decided, setDecided] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [switched, setSwitched] = useState(false);
  // Refs survive React running the effect twice in development: the token is read once per view.
  const decision = useRef<{ os: ThanksOs; auto: boolean } | null>(null);
  const fileRequested = useRef(false);
  const focusFirstStep = useRef(false);
  const firstCaption = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (!decision.current) {
      const params = new URLSearchParams(window.location.search);
      const asked = thanksOs(params.get("os"));
      const from = downloadSurface(params.get("from"));
      const auto = takeThanksToken(asked);
      const shown = asked === "other" ? visitorInstallOs(navigator.userAgent, navigator.maxTouchPoints) : asked;
      // Only the mapped values stay in the address bar, so nothing else reaches a page view or a shared link.
      window.history.replaceState(window.history.state, "", thanksHref(shown, from));
      trackDownloadThanksViewed(shown, from, auto);
      decision.current = { os: shown, auto };
    }
    const { os: shown, auto } = decision.current;
    setOs(shown);
    setDecided(true);
    if (!auto) return undefined;
    if (fileRequested.current) {
      setState("started");
      return undefined;
    }
    setState("preparing");
    let timer = 0;
    const frame = window.requestAnimationFrame(() => {
      timer = window.setTimeout(() => {
        if (fileRequested.current) return;
        fileRequested.current = true;
        // GitHub serves the file as an attachment, so the browser downloads it and this page stays.
        window.location.href = THANKS_DOWNLOADS[shown].href;
        setState("started");
      }, START_DELAY_MS);
    });
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (!focusFirstStep.current) return;
    focusFirstStep.current = false;
    firstCaption.current?.focus();
  }, [os]);

  const onFile = (file: ThanksOs) => {
    // The browser downloads this link itself; the page must not ask for a second file.
    fileRequested.current = true;
    setOs(file);
    // While preparing, the page's own request is now cancelled and this one has started. The ready
    // view keeps its button, so keyboard focus stays on it.
    setState((current) => (current === "preparing" ? "started" : current));
  };

  const onSwitch = () => {
    const next: ThanksOs = os === "windows" ? "mac" : "windows";
    const swap = () => {
      focusFirstStep.current = true;
      setOs(next);
      setLeaving(false);
      setSwitched(true);
    };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      swap();
      return;
    }
    setLeaving(true);
    window.setTimeout(swap, SWITCH_EXIT_MS);
  };

  return (
    <ThanksContent
      os={os}
      state={state}
      decided={decided}
      leaving={leaving}
      switched={switched}
      firstCaptionRef={firstCaption}
      onFile={onFile}
      onSwitch={onSwitch}
    />
  );
}
