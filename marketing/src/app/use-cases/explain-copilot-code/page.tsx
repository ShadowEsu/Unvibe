import type { Metadata } from "next";
import Image from "next/image";
import { UseCaseFacts, UseCaseHead, UseCaseMore, UseCaseSample, UseCaseSteps } from "@/components/paper/UseCaseParts";
import { pageMetadata } from "@/lib/pageMeta";
import { fetchPaymentsOpen } from "@/lib/paymentsStatus";
import { SHORTCUTS } from "@/lib/shortcuts";
import { findUseCase, pathForUseCase } from "@/lib/useCases";
import { D_NAV_CTA } from "@/site/dia/content";
import { DownloadCta } from "@/site/dia/DownloadCta";
import { explainMono } from "../../explain/mono";
import "../../explain/explain.css";
import "../../code-explainer.css";

const page = findUseCase("explain-copilot-code");

/** Re-read the payments status at most every 5 minutes, as /pricing does, for the Free and Pro card. */
export const revalidate = 300;

export const metadata: Metadata = pageMetadata({ path: pathForUseCase(page), title: page.title, description: page.description });

/** A real capture of the panel (the one /code-explainer-mac uses). We have no capture beside VS Code, so the
 *  caption doesn't claim one. GitHub Copilot is named in plain text only: no logo or mark. */
const PANEL_SHOT = {
  src: "/product/os/mac-panel-v0.1.44.webp",
  width: 880,
  height: 1132,
  alt: "The Unvibe panel on a Mac explaining a JavaScript debounce function at the Intermediate depth",
  caption: "Real screen, sample code · Unvibe 0.1.44 on a Mac",
};

/** Hand-written for this page; every behaviour in the notes was checked by running it in Python 3.14.7 (11 Nov). */
const PARSER = `# Parse "1h30m", "45s" or "2h" into seconds.
def parse_duration(text: str) -> int:
    units = {"h": 3600, "m": 60, "s": 1}
    total = 0
    number = ""
    for ch in text.strip().lower():
        if ch.isdigit():
            number += ch
        elif ch in units:
            total += int(number) * units[ch]
            number = ""
        else:
            raise ValueError(f"unexpected character {ch!r} in {text!r}")
    return total`;

/** Search intent: Copilot suggested this; what does it do, and is it right? Same fold as /use-cases/explain-cursor-code
 *  (Design, 7 Nov): the job, one line, a real screenshot and one Download free button; the same button ends the page.
 *  Copilot's own /explain: docs.github.com/en/copilot/reference/chat-cheat-sheet, as of 11 Nov 2026. */
export default async function ExplainCopilotCodePage() {
  const paymentsOpen = await fetchPaymentsOpen();
  return (
    <article className={`explain-page explain-page--uc ${explainMono.variable}`}>
      <UseCaseHead useCase={page} heading="Explain the code GitHub Copilot wrote">
        <div className="uc-fold">
          <div className="uc-fold__text">
            <p>
              A suggestion that looks right is easy to accept with one Tab. Select the code GitHub Copilot wrote, press{" "}
              {SHORTCUTS.mac.anywhere} ({SHORTCUTS.windows.anywhere} on Windows), and Vibe explains it in plain English
              in a panel beside your editor, at the depth you pick. Free for Mac and Windows.
            </p>
            <p className="uc-fold__cta">
              <DownloadCta surface="use_cases" className="d-cta d-btn d-btn--lg">{D_NAV_CTA}</DownloadCta>
              <small>No account and no API key to start.</small>
            </p>
          </div>
          <figure className="os-shot">
            <Image src={PANEL_SHOT.src} width={PANEL_SHOT.width} height={PANEL_SHOT.height} sizes="(min-width: 860px) 400px, 100vw" priority alt={PANEL_SHOT.alt} />
            <figcaption>{PANEL_SHOT.caption}</figcaption>
          </figure>
        </div>
      </UseCaseHead>

      <section className="explain-card" aria-labelledby="copilot-example">
        <h2 id="copilot-example">A worked example</h2>
        <p>
          Say you type the comment on the first line and Copilot suggests the rest. This function is a sample written
          by hand for this page, the kind of code a completion offers for that comment. It is not a recorded Copilot
          suggestion. Every result below was checked by running it in Python 3.14:
        </p>
        <UseCaseSample file="durations.py" code={PARSER} />
        <p>
          The notes below are written by hand to show what a careful read finds. They are not output from Unvibe.
        </p>
        <ul className="explain-notes">
          <li>
            It does what the comment asks: <code>&quot;1h30m&quot;</code> gives 5400, <code>&quot;45s&quot;</code>{" "}
            gives 45 and <code>&quot;2h&quot;</code> gives 7200. Because of <code>.lower()</code>,{" "}
            <code>&quot;1H30M&quot;</code> works too.
          </li>
          <li>
            Digits are only added when a unit letter follows them, and nothing adds what is left after the loop. So{" "}
            <code>&quot;90&quot;</code> returns 0 and <code>&quot;1h30&quot;</code> returns 3600, not 5400, with no
            error. An empty string also returns 0.
          </li>
          <li>
            <code>&quot;500ms&quot;</code> fails with{" "}
            <code>invalid literal for int() with base 10: &apos;&apos;</code>. The <code>m</code> is read as minutes,
            then the <code>s</code> finds no digits before it. The message points at <code>int()</code>, not at the
            input, so it is hard to trace back.
          </li>
          <li>
            <code>&quot;1h 30m&quot;</code> and <code>&quot;1.5h&quot;</code> raise <code>ValueError</code> with
            &ldquo;unexpected character&rdquo;. That may be what you want, but the comment does not say.{" "}
            <code>strip()</code> only removes spaces at the two ends.
          </li>
        </ul>
        <p>
          The function is right for the three examples in its own comment. The inputs the comment does not mention, a
          bare number or a number at the end, come back wrong without an error. Reading it is how you find those
          before someone types &ldquo;90&rdquo;. Start with the lines you would not have written yourself: here, the
          end of the loop and the <code>else</code>.
        </p>
      </section>

      <UseCaseSteps
        select={
          <>
            Select the function in VS Code once you have accepted the suggestion, or the output of <code>git diff</code>{" "}
            in Terminal. Unvibe works in any app where you can select code; in VS Code, the editor bridge
            (Unvibe&apos;s Settings, Integrations) adds {SHORTCUTS.mac.editor} ({SHORTCUTS.windows.editor} on Windows).
          </>
        }
        ask={`Why does "90" return 0 instead of 90?`}
      >
        <p>
          You can ask Copilot Chat to explain the same code: select it and type <code>/explain</code>, which
          GitHub&apos;s Copilot Chat cheat sheet describes as explaining how the code in your active editor works.
          Often that is enough. The difference is what happens next: a chat answer scrolls away, while Unvibe&apos;s
          explanation sits beside the code at the depth you chose, is saved to your Library, and Test me can check
          that you got it. It also works on code you select outside your editor: a <code>git diff</code> in Terminal,
          a file on GitHub, a snippet in the docs.
        </p>
        <p>
          When Copilot&apos;s agent mode changes many files at once, Briefs list what changed in your working tree,
          staged files, the latest commit or a branch. Briefs are made on your computer for free; the AI explanation
          of a change is Pro.
        </p>
      </UseCaseSteps>

      <UseCaseFacts paymentsOpen={paymentsOpen} />

      <section className="explain-card explain-get" aria-labelledby="copilot-get">
        <h2 id="copilot-get">Explain the next thing Copilot writes</h2>
        <p>
          Unvibe is a free app for Mac and Windows. There is nothing to paste: select code in VS Code or any other app
          and press {SHORTCUTS.mac.anywhere} ({SHORTCUTS.windows.anywhere} on Windows).
        </p>
        <p className="uc-end">
          <DownloadCta surface="use_cases" className="d-cta d-btn d-btn--lg">{D_NAV_CTA}</DownloadCta>
          <small>No account and no API key to start.</small>
        </p>
      </section>

      <UseCaseMore current={page} explain={{ id: "python", name: "Python" }} />
    </article>
  );
}
