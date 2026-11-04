import type { Metadata } from "next";
import { ExplainDownload } from "@/components/paper/ExplainParts";
import { UseCaseFacts, UseCaseHead, UseCaseMore, UseCaseSample, UseCaseSteps } from "@/components/paper/UseCaseParts";
import { pageMetadata } from "@/lib/pageMeta";
import { fetchPaymentsOpen } from "@/lib/paymentsStatus";
import { useCase, useCasePath } from "@/lib/useCases";
import { explainMono } from "../../explain/mono";
import "../../explain/explain.css";
import "../../code-explainer.css";

const page = useCase("learn-to-code-with-ai");

/** Re-read the payments status at most every 5 minutes, as /pricing does, for the Free and Pro card. */
export const revalidate = 300;

export const metadata: Metadata = pageMetadata({ path: useCasePath(page), title: page.title, description: page.description });

const SCRIPT = `from collections import Counter

def top_words(path, n=5):
    with open(path, encoding="utf-8") as f:
        words = f.read().lower().split()
    return Counter(words).most_common(n)

print(top_words("notes.txt"))`;

/** Search intent: I build with AI while I learn; how do I understand what it wrote? */
export default async function LearnToCodeWithAiPage() {
  const paymentsOpen = await fetchPaymentsOpen();
  return (
    <article className={`explain-page ${explainMono.variable}`}>
      <UseCaseHead useCase={page} heading="Learn to code from the code AI writes for you">
        <p>
          If an AI tool writes most of your project, the project can work while you still cannot say how. You find out
          when it breaks, when you need to change it, or when someone asks you to walk them through it. The way out is to
          read what it wrote, one small piece at a time, until you could have written it yourself.
        </p>
        <p>
          Unvibe is not a code generator. It helps you understand the code you already have: pick New or Beginner and
          read your own project at your level.
        </p>
      </UseCaseHead>

      <section className="explain-card" aria-labelledby="learn-example">
        <h2 id="learn-example">A worked example</h2>
        <p>You ask a chatbot for a Python script that finds the most common words in a text file. It gives you this:</p>
        <UseCaseSample file="word_count.py" code={SCRIPT} />
        <p>
          The notes below are written by hand to show what is worth understanding in this script. They are not output
          from Unvibe.
        </p>
        <ul className="explain-notes">
          <li>
            <code>from collections import Counter</code> loads <code>Counter</code> from Python&apos;s standard library,
            so there is nothing to install.
          </li>
          <li>
            <code>n=5</code> is a default value. <code>top_words(&quot;notes.txt&quot;)</code> returns five words;{" "}
            <code>top_words(&quot;notes.txt&quot;, 10)</code> returns ten.
          </li>
          <li>
            <code>with open(...) as f:</code> opens the file and closes it when the indented block ends, even if an error
            happens inside the block.
          </li>
          <li>
            <code>f.read().lower().split()</code> runs left to right: read the whole file into one string, make it
            lowercase, then split it on spaces, tabs and line breaks into a list of words.
          </li>
          <li>
            <code>Counter(words).most_common(n)</code> counts how often each word appears, then returns the{" "}
            <code>n</code> most common as a list of (word, count) pairs, such as <code>(&apos;the&apos;, 12)</code>.
          </li>
        </ul>
        <p className="explain-watch">
          <b>Watch out:</b> <code>split()</code> keeps punctuation, so <code>done.</code> and <code>done</code> count as
          two different words. The script runs without an error, so only reading it tells you.
        </p>
      </section>

      <section className="explain-card" aria-labelledby="learn-habits">
        <h2 id="learn-habits">How to learn from code AI wrote</h2>
        <p>None of these need an app.</p>
        <ol className="explain-notes">
          <li>
            Ask for one small piece at a time. You can read a ten-line function in one sitting. You cannot read a whole
            app that way.
          </li>
          <li>
            Predict before you run. Write down what you expect the code to print, run it and compare. A wrong guess
            shows you exactly what to study.
          </li>
          <li>
            Change one thing and watch what happens: remove <code>.lower()</code>, change <code>n</code>, point it at a
            file that does not exist.
          </li>
          <li>
            Explain it back in your own words, as a comment above each line or out loud. The line you cannot explain is
            the one to look up.
          </li>
          <li>
            Look up each new name once in the official documentation (here, <code>Counter</code> and the{" "}
            <code>with</code> statement) and keep a list of what you looked up.
          </li>
          <li>Retype short pieces instead of pasting them. Typing makes you notice every symbol.</li>
          <li>Come back a few days later and explain it again without looking.</li>
        </ol>
      </section>

      <UseCaseSteps
        select="Select a function from your project, in your editor or in your browser."
        ask="Why use with instead of calling open on its own?"
      >
        <p>
          Lessons you keep are saved to your Library on your computer. The Today page sets a small daily goal: explain
          one piece of code and answer one question. On the Quiz page, pick a saved lesson and check what stayed with
          you, days after you first read it.
        </p>
      </UseCaseSteps>

      <UseCaseFacts paymentsOpen={paymentsOpen} />

      <ExplainDownload surface="use_cases" />

      <UseCaseMore current={page} explain={{ id: "python", name: "Python" }} />
    </article>
  );
}
