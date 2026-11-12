import type { Metadata } from "next";
import { ExplainDownload } from "@/components/paper/ExplainParts";
import { UseCaseFacts, UseCaseHead, UseCaseMore, UseCaseSample, UseCaseSteps } from "@/components/paper/UseCaseParts";
import { pageMetadata } from "@/lib/pageMeta";
import { fetchPaymentsOpen } from "@/lib/paymentsStatus";
import { findUseCase, pathForUseCase } from "@/lib/useCases";
import { SHORTCUTS } from "@/lib/shortcuts";
import { D_STATEMENT } from "@/site/dia/content";
import { explainMono } from "../../explain/mono";
import "../../explain/explain.css";
import "../../code-explainer.css";

const page = findUseCase("inherited-code");

/** Re-read the payments status at most every 5 minutes, as /pricing does, for the Free and Pro card. */
export const revalidate = 300;

export const metadata: Metadata = pageMetadata({ path: pathForUseCase(page), title: page.title, description: page.description });

const FUNCTION = `export function normalizeEmail(raw) {
  const email = raw.trim().toLowerCase();
  const [local, domain] = email.split("@");
  if (domain === "gmail.com" || domain === "googlemail.com") {
    return local.split("+")[0].replaceAll(".", "") + "@gmail.com";
  }
  return email;
}`;

/** Search intent: I have to change a file in a codebase I did not write; how do I understand it first? */
export default async function InheritedCodePage() {
  const paymentsOpen = await fetchPaymentsOpen();
  return (
    <article className={`explain-page ${explainMono.variable}`}>
      <UseCaseHead useCase={page} heading="Understand code you didn't write before you change it">
        <p>
          {D_STATEMENT.entity} Select a function, a file or a diff, press {SHORTCUTS.mac.anywhere} (
          {SHORTCUTS.windows.anywhere} on Windows), and Vibe explains it beside your editor: what it does, in the words
          you would use, before you change it.
        </p>
        <p>
          A teammate&apos;s service, your own project from two years ago, an open-source repo you want to fix. The code
          works, the person who wrote it is not around to ask, and you need to change one file without breaking what
          depends on it. Below is an order for reading a file like that, then a worked example.
        </p>
      </UseCaseHead>

      <section className="explain-card" aria-labelledby="inherited-order">
        <h2 id="inherited-order">How to read an unfamiliar file</h2>
        <ol className="explain-notes">
          <li>
            Start with who uses it. Search the project for the file&apos;s exported names. The callers tell you what the
            file is for and which parts of it matter.
          </li>
          <li>
            Read the imports. They show what the file depends on: a framework, a database client, other modules in the
            project.
          </li>
          <li>Read the exported names and their signatures before any function body.</li>
          <li>Read the data shapes: types, schemas and the constants near the top.</li>
          <li>Follow one real input through one function, end to end, and write down what comes out.</li>
          <li>
            Mark the side effects: network calls, file and database writes, global state, environment variables,
            timers. These are what break when you change the file.
          </li>
          <li>
            Read its tests, if it has any. They show what the author meant it to do, including the edge cases they
            thought of.
          </li>
          <li>
            Read its history. <code>git log --follow -p -- path/to/file</code> shows every change to the file;{" "}
            <code>git blame -L 40,60 path/to/file</code> shows which commit last touched lines 40 to 60. The commit
            message can explain the line that looks wrong.
          </li>
          <li>Run the tests before you change anything, so you know which failures are yours.</li>
        </ol>
      </section>

      <section className="explain-card" aria-labelledby="inherited-example">
        <h2 id="inherited-example">A worked example</h2>
        <p>
          You are fixing a sign-up bug and find this function. It runs before an account is saved and before sign-in
          looks one up.
        </p>
        <UseCaseSample file="accounts.js" code={FUNCTION} />
        <p>
          The notes below are written by hand to show what a careful read finds. They are not output from Unvibe.
        </p>
        <ul className="explain-notes">
          <li>The first line removes spaces around the address and lowercases all of it.</li>
          <li>
            <code>const [local, domain] = email.split(&quot;@&quot;)</code> puts the part before the @ in{" "}
            <code>local</code> and the part after it in <code>domain</code>. With no @ at all, <code>domain</code> is{" "}
            <code>undefined</code> and the function returns the trimmed, lowercased input.
          </li>
          <li>
            The Gmail branch is the part that needs a reason. Gmail ignores dots before the @ and anything after a +, and
            googlemail.com reaches the same inbox. So <code>J.Doe+shop@gmail.com</code> and{" "}
            <code>jdoe@googlemail.com</code> both become <code>jdoe@gmail.com</code>.
          </li>
          <li>
            A likely reason is to treat those addresses as one account, for example so one person cannot sign up twice.
            That is a guess from the code. The commit that added the branch is the evidence.
          </li>
          <li>
            If it has run before every save, existing accounts are stored under the normalized address, and sign-in finds
            them by it. Change the rule and some people stop matching their own account, so a change here needs a plan
            for the addresses already saved.
          </li>
        </ul>
      </section>

      <UseCaseSteps select="Select the function in your editor." ask="What breaks if I remove the Gmail branch?">
        <p>
          To see why lines are there, use &ldquo;Why does this exist?&rdquo;. It answers from git blame and the
          file&apos;s last 8 commits, which Unvibe reads in the repository on your computer. It shows when the lines
          were added and the commit message behind them, and keeps those facts separate from inference. It needs to know
          which file the selection came from, and that file has to be in a git repository.
        </p>
        <p>
          Unvibe does not explain a whole repository in one go. It explains what you select, and your whole codebase is
          never sent. On Pro, answers can use up to two files the selection imports (the first 4,000 characters of
          each).
        </p>
      </UseCaseSteps>

      <UseCaseFacts paymentsOpen={paymentsOpen} />

      <ExplainDownload surface="use_cases" />

      <UseCaseMore current={page} explain={{ id: "javascript", name: "JavaScript" }} />
    </article>
  );
}
