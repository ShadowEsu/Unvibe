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

const page = findUseCase("explain-chatgpt-code");

/** Re-read the payments status at most every 5 minutes, as /pricing does, for the Free and Pro card. */
export const revalidate = 300;

export const metadata: Metadata = pageMetadata({ path: pathForUseCase(page), title: page.title, description: page.description });

/** A real capture of the panel (the one /code-explainer-windows uses). We have no capture beside ChatGPT, so the
 *  caption doesn't claim one. ChatGPT is named in plain text only: no logo or mark. */
const PANEL_SHOT = {
  src: "/product/os/windows-panel-v0.1.44.webp",
  width: 560,
  height: 640,
  alt: "The Unvibe panel on Windows explaining JavaScript selected in Notepad, with what to check next",
  caption: "Real screen, sample code · Unvibe 0.1.44 on Windows",
};

/** Hand-written for this page; every result in the notes was checked by running it in Node.js 25.7 (11 Nov). */
const SCRIPT = `// Add up the "amount" column of a CSV export.
const fs = require("fs");

function totalAmount(path) {
  const lines = fs.readFileSync(path, "utf8").trim().split("\\n");
  const header = lines[0].split(",");
  const col = header.indexOf("amount");
  let total = 0;
  for (const line of lines.slice(1)) {
    const cells = line.split(",");
    total += parseFloat(cells[col]);
  }
  return total.toFixed(2);
}

console.log(totalAmount(process.argv[2]));`;

/** Search intent: ChatGPT gave me this code; what does it do, and is it right? Same fold as
 *  /use-cases/explain-cursor-code (Design, 7 Nov): the job, one line, a real screenshot and one Download free button;
 *  the same button ends the page. ChatGPT explaining things: help.openai.com/en/articles/9260256, as of 11 Nov 2026. */
export default async function ExplainChatgptCodePage() {
  const paymentsOpen = await fetchPaymentsOpen();
  return (
    <article className={`explain-page explain-page--uc ${explainMono.variable}`}>
      <UseCaseHead useCase={page} heading="Explain the code ChatGPT wrote">
        <div className="uc-fold">
          <div className="uc-fold__text">
            <p>
              The answer around the code says what it is for; the code is what will run. Select the code ChatGPT wrote,
              in your browser or after you paste it into your editor, press {SHORTCUTS.mac.anywhere} (
              {SHORTCUTS.windows.anywhere} on Windows), and Vibe explains it in plain English in a panel beside it, at
              the depth you pick. Free for Mac and Windows.
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

      <section className="explain-card" aria-labelledby="chatgpt-example">
        <h2 id="chatgpt-example">A worked example</h2>
        <p>
          Say you ask ChatGPT for a script that adds up the amount column of a CSV export. This script is a sample
          written by hand for this page, the kind of answer a chat gives for that request. It is not a recorded ChatGPT
          answer. Every result below was checked by running it in Node.js 25:
        </p>
        <UseCaseSample file="total.js" code={SCRIPT} />
        <p>
          The notes below are written by hand to show what a careful read finds. They are not output from Unvibe.
        </p>
        <ul className="explain-notes">
          <li>
            On a simple file it works: two rows of 12.50 and 7.25 print 19.75. <code>trim()</code> drops the newline at
            the end of the file, so there is no empty last row.
          </li>
          <li>
            <code>line.split(&quot;,&quot;)</code> splits on every comma, including one inside quotes. A customer named{" "}
            <code>&quot;Ruiz, Ana&quot;</code> pushes the amount one column to the right, and the total prints{" "}
            <code>NaN</code>. A quoted <code>&quot;1,200.00&quot;</code> does the same.
          </li>
          <li>
            A file saved on Windows ends each line with <code>\r\n</code>. The last header cell becomes{" "}
            <code>&quot;amount\r&quot;</code>, <code>indexOf</code> returns -1, <code>cells[-1]</code> is{" "}
            <code>undefined</code>, and every row adds <code>NaN</code>.
          </li>
          <li>
            One blank amount makes the whole total <code>NaN</code>: <code>parseFloat(&quot;&quot;)</code> is{" "}
            <code>NaN</code>, and <code>NaN</code> plus any number is <code>NaN</code>.
          </li>
          <li>
            <code>toFixed(2)</code> returns text, not a number. Code that adds 1 to the result gets{" "}
            <code>&quot;19.751&quot;</code>.
          </li>
        </ul>
        <p>
          The script answers the question as it was asked. The cases nobody mentioned, quotes, Windows line endings and
          blanks, print <code>NaN</code> or a wrong total with no error. Reading it is how you find those before the
          number goes into a report. Start with the lines that split text: here, the two <code>split</code> calls.
        </p>
      </section>

      <UseCaseSteps
        select={
          <>
            Select the code in the ChatGPT tab in your browser, or in your editor after you paste it. Unvibe works in
            any app where you can select code; in VS Code and Cursor, the editor bridge (Unvibe&apos;s Settings,
            Integrations) adds {SHORTCUTS.mac.editor} ({SHORTCUTS.windows.editor} on Windows).
          </>
        }
        ask={`Why is the total NaN when a customer's name has a comma in it?`}
      >
        <p>
          You can ask ChatGPT to explain its own code, and often that is enough: explaining is one of the things OpenAI
          lists ChatGPT for. The difference is where the explanation lives. A chat answer stays in the chat, while
          Unvibe&apos;s explanation sits beside the code wherever you selected it, at the depth you chose, is saved to
          your Library, and Test me can check that you got it. It still works a week later, after you have pasted the
          code into your project and changed it.
        </p>
        <p>
          Once the code is in a project, Briefs list what changed in your working tree, staged files, the latest commit
          or a branch. Briefs are made on your computer for free; the AI explanation of a change is Pro.
        </p>
      </UseCaseSteps>

      <UseCaseFacts paymentsOpen={paymentsOpen} />

      <section className="explain-card explain-get" aria-labelledby="chatgpt-get">
        <h2 id="chatgpt-get">Explain the next script ChatGPT gives you</h2>
        <p>
          Unvibe is a free app for Mac and Windows. There is nothing to paste: select code in your browser, your editor
          or any other app and press {SHORTCUTS.mac.anywhere} ({SHORTCUTS.windows.anywhere} on Windows).
        </p>
        <p className="uc-end">
          <DownloadCta surface="use_cases" className="d-cta d-btn d-btn--lg">{D_NAV_CTA}</DownloadCta>
          <small>No account and no API key to start.</small>
        </p>
      </section>

      <UseCaseMore current={page} explain={{ id: "javascript", name: "JavaScript" }} />
    </article>
  );
}
