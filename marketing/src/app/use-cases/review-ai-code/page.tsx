import type { Metadata } from "next";
import { ExplainDownload } from "@/components/paper/ExplainParts";
import { UseCaseFacts, UseCaseHead, UseCaseMore, UseCaseSample, UseCaseSteps } from "@/components/paper/UseCaseParts";
import { pageMetadata } from "@/lib/pageMeta";
import { fetchPaymentsOpen } from "@/lib/paymentsStatus";
import { SHORTCUTS } from "@/lib/shortcuts";
import { findUseCase, pathForUseCase } from "@/lib/useCases";
import { D_STATEMENT } from "@/site/dia/content";
import { explainMono } from "../../explain/mono";
import "../../explain/explain.css";
import "../../code-explainer.css";

const page = findUseCase("review-ai-code");

/** Re-read the payments status at most every 5 minutes, as /pricing does, for the Free and Pro card. */
export const revalidate = 300;

export const metadata: Metadata = pageMetadata({ path: pathForUseCase(page), title: page.title, description: page.description });

const DIFF = ` export async function fetchUser(id: string): Promise<User> {
-  const res = await fetch(\`/api/users/\${id}\`);
-  return res.json();
+  for (let attempt = 1; attempt <= 3; attempt++) {
+    try {
+      const res = await fetch(\`/api/users/\${id}\`);
+      if (!res.ok) throw new Error(\`HTTP \${res.status}\`);
+      return await res.json();
+    } catch (err) {
+      if (attempt === 3) throw err;
+      await new Promise((resolve) => setTimeout(resolve, 200 * attempt));
+    }
+  }
+  throw new Error("unreachable");
 }`;

/** Search intent: an agent just changed my code; how do I check it before I accept or commit it? */
export default async function ReviewAiCodePage() {
  const paymentsOpen = await fetchPaymentsOpen();
  return (
    <article className={`explain-page ${explainMono.variable}`}>
      <UseCaseHead useCase={page} heading="Understand an AI code change before you accept it">
        <p>
          {D_STATEMENT.entity} It does not write code. Select what an agent wrote, press {SHORTCUTS.mac.anywhere} (
          {SHORTCUTS.windows.anywhere} on Windows), and Vibe explains the change beside your editor.
        </p>
        <p>
          Cursor, Claude Code and Copilot can change several files in the time it takes you to read one. The
          agent&apos;s summary tells you what it meant to do; the diff is what it did. Before you accept or commit, you
          should be able to say what each changed line does and what it changes for the code that calls it.
        </p>
      </UseCaseHead>

      <section className="explain-card" aria-labelledby="review-example">
        <h2 id="review-example">A worked example</h2>
        <p>You ask an agent to add retries to a function that loads a user. This is the diff it hands back:</p>
        <UseCaseSample file="users.ts" code={DIFF} />
        <p>
          The notes below are written by hand to show what a careful read finds. They are not output from Unvibe.
        </p>
        <ul className="explain-notes">
          <li>
            It changes more than retries. The new <code>if (!res.ok)</code> line turns every 404 or 500 into a thrown
            error. Before, the function returned whatever the server&apos;s error body parsed to, so a caller that
            checked the result for an error field now gets an exception instead.
          </li>
          <li>
            It retries errors that will not go away. A user that does not exist now costs three requests and 600
            milliseconds of waiting (200, then 400) before the caller hears about it.
          </li>
          <li>
            <code>return await res.json()</code> is deliberate. Without the <code>await</code>, a body that fails to
            parse would reject outside the <code>try</code> block, and the <code>catch</code> would never see it.
          </li>
          <li>
            The last line, <code>throw new Error(&quot;unreachable&quot;)</code>, never runs. It is there because
            TypeScript cannot tell that the loop always returns or throws.
          </li>
          <li>
            Retrying is safe here because the request only reads. The same loop around a request that creates an order
            or charges a card could do it more than once.
          </li>
        </ul>
        <p>
          None of this makes the change wrong. It makes it a bigger change than the one you asked for. Before you
          accept it, decide whether a 404 should be retried and whether the callers expect an exception.
        </p>
      </section>

      <section className="explain-card" aria-labelledby="review-checklist">
        <h2 id="review-checklist">What to check in an AI diff before you accept it</h2>
        <ol className="explain-notes">
          <li>
            Read the diff, not the agent&apos;s summary of it. <code>git diff</code> shows unstaged changes,{" "}
            <code>git diff --staged</code> shows what you staged, and <code>git diff --stat</code> lists which files
            changed and by how much.
          </li>
          <li>
            Check that it stays inside what you asked for. Note every file or line you did not expect: reformatting,
            renamed variables, deleted comments, edited config or lockfiles.
          </li>
          <li>
            Look for changes the callers will feel: a new exception, a different return value or type, a changed
            default, a removed parameter.
          </li>
          <li>
            Walk the failure paths: an error response, an empty list, a missing value, a timeout. A quick read follows
            the path where everything works.
          </li>
          <li>
            Check the tests. A deleted test, a new skip or an assertion loosened until it passes means that test no
            longer checks what it used to.
          </li>
          <li>
            Check every new import and dependency. Make sure the package exists, is the one you meant and is needed at
            all. AI tools sometimes name packages that do not exist.
          </li>
          <li>Search the diff for keys and tokens, debug logging, hard-coded URLs and leftover TODO comments.</li>
          <li>Run it. Run the tests, then try the changed path yourself, including one way it can fail.</li>
          <li>
            If you cannot explain a line, do not accept it yet. Ask about it, or ask the agent for a smaller change.
          </li>
        </ol>
      </section>

      <UseCaseSteps
        select={
          <>
            Select the changed function in your editor, or the output of <code>git diff</code> in Terminal. Unvibe works
            in any app where you can select code, including Cursor, VS Code and Terminal.
          </>
        }
        ask="What happens to callers when the API returns 404?"
      >
        <p>
          For a change across several files, Briefs list what changed in your working tree, staged files, the latest
          commit or a branch. Briefs are made on your computer for free; the AI explanation of a change is Pro. When an
          agent changes many files, After-Agent Review in Briefs ranks the change by what deserves a human look, on your
          computer; the AI explanation of that change is Pro.
        </p>
      </UseCaseSteps>

      <UseCaseFacts paymentsOpen={paymentsOpen} />

      <ExplainDownload surface="use_cases" />

      <UseCaseMore current={page} explain={{ id: "typescript", name: "TypeScript" }} />
    </article>
  );
}
