import type { Metadata } from "next";
import { ExplainDownload } from "@/components/paper/ExplainParts";
import { UseCaseFacts, UseCaseHead, UseCaseMore, UseCaseSample, UseCaseSteps } from "@/components/paper/UseCaseParts";
import { pageMetadata } from "@/lib/pageMeta";
import { fetchPaymentsOpen } from "@/lib/paymentsStatus";
import { SHORTCUTS } from "@/lib/shortcuts";
import { findUseCase, pathForUseCase } from "@/lib/useCases";
import { explainMono } from "../../explain/mono";
import "../../explain/explain.css";
import "../../code-explainer.css";

const page = findUseCase("explain-cursor-code");

/** Re-read the payments status at most every 5 minutes, as /pricing does, for the Free and Pro card. */
export const revalidate = 300;

export const metadata: Metadata = pageMetadata({ path: pathForUseCase(page), title: page.title, description: page.description });

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

/** Search intent: Cursor wrote this; what does it do, and is it right? */
export default async function ExplainCursorCodePage() {
  const paymentsOpen = await fetchPaymentsOpen();
  return (
    <article className={`explain-page ${explainMono.variable}`}>
      <UseCaseHead useCase={page} heading="Explain the code Cursor wrote, line by line">
        <p>
          Cursor&apos;s Agent edits files from a sentence, and Tab finishes the line you started. You press accept, the
          code is in your project, and the chat has moved on. The summary in the chat says what Cursor meant to do. The
          file is what it did. If a line in it would be new to you, you should be able to say what it does before you
          ship it.
        </p>
        <p>
          Unvibe does not write code. Select what Cursor wrote, press {SHORTCUTS.mac.anywhere} (
          {SHORTCUTS.windows.anywhere} on Windows), and Vibe explains it in plain English in a panel beside Cursor, at
          the depth you pick. With the editor bridge, {SHORTCUTS.mac.editor} ({SHORTCUTS.windows.editor} on Windows)
          works inside Cursor too.
        </p>
      </UseCaseHead>

      <section className="explain-card" aria-labelledby="cursor-example">
        <h2 id="cursor-example">A worked example</h2>
        <p>
          You ask Cursor&apos;s Agent for a search box that loads results as you type. Among the files it changes is
          this hook:
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
            &ldquo;react&rdquo; and overwrite it. Cursor added <code>AbortController</code> for that reason, without
            being asked.
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
          Cursor did what you asked. It also made two decisions you did not ask about, one of them wrong. Reading the
          hook is how you find out which.
        </p>
      </section>

      <section className="explain-card" aria-labelledby="cursor-routine">
        <h2 id="cursor-routine">A short routine for code Cursor wrote</h2>
        <ol className="explain-notes">
          <li>
            Read the change before the chat&apos;s summary of it. Cursor shows each edit for you to accept or reject;
            the summary is what it meant, the edit is what it did.
          </li>
          <li>
            Pick out the lines you would not have written yourself. In the hook above, that is{" "}
            <code>AbortController</code>, <code>signal</code>, <code>finally</code> and the dependency array. Those
            are the lines to explain first.
          </li>
          <li>
            For each one, ask what happens on the unhappy path: the request fails, the user types again before it
            answers, the server returns nothing.
          </li>
          <li>
            Check every import Cursor added. Make sure the package exists and is the one you meant. AI tools sometimes
            name packages that do not exist.
          </li>
          <li>
            Search the change for keys and tokens, debug logging and hard-coded URLs before you commit it.
          </li>
          <li>
            Run it, and try the way it can fail. Here, type quickly and watch the loading state.
          </li>
          <li>
            If a line still does not make sense, do not accept it yet. Ask about that line, or ask Cursor for a smaller
            change.
          </li>
        </ol>
        <p>
          You can ask Cursor&apos;s chat to explain its own code, and often that is enough. The difference is what
          happens next: a chat answer scrolls away, while Unvibe&apos;s explanation sits beside the code at the depth
          you chose, is saved to your Library, and Test me can check that you got it. It also works on code you
          select outside Cursor: a <code>git diff</code> in Terminal, a file on GitHub, a snippet in the docs.
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
          When Cursor&apos;s Agent changes many files at once, Briefs list what changed in your working tree, staged
          files, the latest commit or a branch. Briefs are made on your computer for free; the AI explanation of a
          change is Pro. After-Agent Review in Briefs ranks the change by what deserves a human look, on your computer;
          the AI explanation of that change is Pro.
        </p>
      </UseCaseSteps>

      <UseCaseFacts paymentsOpen={paymentsOpen} />

      <ExplainDownload surface="use_cases" />

      <UseCaseMore current={page} explain={{ id: "typescript", name: "TypeScript" }} />
    </article>
  );
}
