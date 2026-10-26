import { GetUnvibe } from "@/components/paper/GetUnvibe";
import { SHORTCUTS } from "@/lib/shortcuts";

/** Page copy from explainPages.ts: text between `backticks` renders as code. */
export function Prose({ text }: { text: string }) {
  return <>{text.split("`").map((part, i) => (i % 2 === 1 ? <code key={i}>{part}</code> : part))}</>;
}

/** The download step at the end of every /explain page. */
export function ExplainDownload({ language }: { language?: string }) {
  return (
    <section className="explain-card explain-get" aria-labelledby="explain-get-title">
      <h2 id="explain-get-title">Explain {language ? `${language} code` : "code"} beside your editor</h2>
      <p>
        Unvibe is a free app for Mac and Windows. In the app there is no pasting: select code in any app and press{" "}
        {SHORTCUTS.mac.anywhere} ({SHORTCUTS.windows.anywhere} on Windows).
      </p>
      <GetUnvibe surface="explain" />
    </section>
  );
}
