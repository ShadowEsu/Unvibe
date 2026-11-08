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

const page = findUseCase("explain-cursor-code");

/** Re-read the payments status at most every 5 minutes, as /pricing does, for the Free and Pro card. */
export const revalidate = 300;

export const metadata: Metadata = pageMetadata({ path: pathForUseCase(page), title: page.title, description: page.description });

/** The one real capture of the panel beside Cursor: Unvibe 0.1.48 explaining Cursor's debounce sample (public/product). */
const CURSOR_SHOT = {
  src: "/product/unvibe-0148-debounce-1180.webp",
  width: 1180,
  height: 846,
  alt: "Cursor with the Unvibe panel open beside it, explaining a TypeScript debounce function at the Intermediate depth",
  caption: "Real screen, sample code · Unvibe 0.1.48 beside Cursor",
};

const HOOK = `export function useSearch(query: string) {
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    fetch(\`/api/search?q=\${encodeURIComponent(query)}\`, { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => setResults(data.results))
      .catch((err) => {
        if (err.name !== "AbortError") console.error(err);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [query]);

  return { results, loading };
}`;

/** Search intent: Cursor wrote this; what does it do, and is it right? Fold per Design (7 Nov): the job, one line,
 *  the real screenshot of that job and one Download free button; the same button ends the page. */
export default async function ExplainCursorCodePage() {
  const paymentsOpen = await fetchPaymentsOpen();
  return (
    <article className={`explain-page ${explainMono.variable}`}>
      <UseCaseHead useCase={page} heading="Explain the code Cursor wrote">
        <div className="uc-fold">
          <div className="uc-fold__text">
            <p>
              Cursor&apos;s chat says what it meant to do; the file is what it did. Select the code Cursor wrote, press{" "}
              {SHORTCUTS.mac.anywhere} ({SHORTCUTS.windows.anywhere} on Windows), and Vibe explains it in plain English
              in a panel beside Cursor, at the depth you pick. Free for Mac and Windows.
            </p>
            <p className="uc-fold__cta">
              <DownloadCta surface="use_cases" className="d-cta d-btn d-btn--lg">{D_NAV_CTA}</DownloadCta>
              <small>No account and no API key to start.</small>
            </p>
          </div>
          <figure className="os-shot">
            <Image src={CURSOR_SHOT.src} width={CURSOR_SHOT.width} height={CURSOR_SHOT.height} sizes="(min-width: 860px) 512px, 100vw" priority alt={CURSOR_SHOT.alt} />
            <figcaption>{CURSOR_SHOT.caption}</figcaption>
          </figure>
        </div>
      </UseCaseHead>

      <section className="explain-card" aria-labelledby="cursor-example">
        <h2 id="cursor-example">A worked example</h2>
        <p>
          Say you ask Cursor&apos;s Agent for a search box that loads results as you type. This hook is a sample
          written by hand for this page, the kind of code an agent hands back for that request. It is not a recorded
          Cursor run:
        </p>
        <UseCaseSample file="useSearch.ts" code={HOOK} />
        <p>
          The notes below are written by hand to show what a careful read finds. They are not output from Unvibe.
        </p>
        <ul className="explain-notes">
          <li>
            The effect runs again every time <code>query</code> changes, and the function it returns runs first,
            before the next run. That function calls <code>controller.abort()</code>, which cancels the previous
            request. Without it, a slow answer for &ldquo;re&rdquo; could arrive after the answer for
            &ldquo;react&rdquo; and overwrite it. An agent often adds <code>AbortController</code> for that reason
            without being asked, and the request did not ask for it.
          </li>
          <li>
            A cancelled request still ends. Its <code>finally</code> runs and sets <code>loading</code> to false,
            even though the newer request is still in flight. Type fast and the spinner flickers off while results
            are still loading. That is a real bug, and it is easy to miss because every line looks reasonable on its
            own.
          </li>
          <li>
            <code>err.name !== &quot;AbortError&quot;</code> is deliberate: an aborted <code>fetch</code> rejects with
            an error named <code>AbortError</code>, and that one is expected, so it is not logged.
          </li>
          <li>
            There is no check of <code>res.ok</code>. When the server answers 500 with an HTML error page,{" "}
            <code>res.json()</code> throws, the error is logged to the console, and the old results stay on screen with
            nothing to tell the user.
          </li>
          <li>
            <code>encodeURIComponent</code> keeps a query like <code>a&amp;b</code> or <code>50%</code> from being read
            as part of the URL instead of the search text.
          </li>
          <li>
            There is no delay between keystrokes, so typing &ldquo;react&rdquo; sends five requests. Whether that
            matters depends on what <code>/api/search</code> costs.
          </li>
        </ul>
        <p>
          The sample does what was asked. It also makes two decisions that were not asked for, one of them wrong.
          Reading the hook is how you find out which. Start with the lines you would not have written yourself: here,{" "}
          <code>AbortController</code>, <code>signal</code>, <code>finally</code> and the dependency array.
        </p>
      </section>

      <UseCaseSteps
        select={
          <>
            Select the hook in Cursor&apos;s editor, or the output of <code>git diff</code> in Terminal. Unvibe works in
            any app where you can select code; in Cursor, the editor bridge (Unvibe&apos;s Settings, Integrations)
            adds {SHORTCUTS.mac.editor} ({SHORTCUTS.windows.editor} on Windows).
          </>
        }
        ask="Why does loading turn off while the second request is still running?"
      >
        <p>
          You can ask Cursor&apos;s chat to explain its own code, and often that is enough. The difference is what
          happens next: a chat answer scrolls away, while Unvibe&apos;s explanation sits beside the code at the depth
          you chose, is saved to your Library, and Test me can check that you got it. It also works on code you select
          outside Cursor: a <code>git diff</code> in Terminal, a file on GitHub, a snippet in the docs.
        </p>
        <p>
          When Cursor&apos;s Agent changes many files at once, Briefs list what changed in your working tree, staged
          files, the latest commit or a branch. Briefs are made on your computer for free; the AI explanation of a
          change is Pro. After-Agent Review in Briefs ranks the change by what deserves a human look, on your computer;
          the AI explanation of that change is Pro.
        </p>
      </UseCaseSteps>

      <UseCaseFacts paymentsOpen={paymentsOpen} />

      <section className="explain-card explain-get" aria-labelledby="cursor-get">
        <h2 id="cursor-get">Explain the next thing Cursor writes</h2>
        <p>
          Unvibe is a free app for Mac and Windows. There is nothing to paste: select code in Cursor or any other app
          and press {SHORTCUTS.mac.anywhere} ({SHORTCUTS.windows.anywhere} on Windows).
        </p>
        <p className="uc-end">
          <DownloadCta surface="use_cases" className="d-cta d-btn d-btn--lg">{D_NAV_CTA}</DownloadCta>
          <small>No account and no API key to start.</small>
        </p>
      </section>

      <UseCaseMore current={page} explain={{ id: "typescript", name: "TypeScript" }} />
    </article>
  );
}
