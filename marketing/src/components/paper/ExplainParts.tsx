import { GetUnvibe } from "@/components/paper/GetUnvibe";
import type { DownloadSurface } from "@/lib/downloadTracking";
import { SHORTCUTS } from "@/lib/shortcuts";

/** Page copy from explainPages.ts: text between `backticks` renders as code. */
export function Prose({ text }: { text: string }) {
  return <>{text.split("`").map((part, i) => (i % 2 === 1 ? <code key={i}>{part}</code> : part))}</>;
}

/**
 * The download step at the end of every /explain and /use-cases page. `subject` is what the page explains ("Python code").
 * `forAiCode`: the /explain/<page> wording (ledger 636), for code an AI tool wrote, with the shortcut spelled out per OS
 * as /beta says it; the hub, FAQ and use-case pages keep the plain wording.
 */
export function ExplainDownload({ subject = "code", surface = "explain", forAiCode = false }: { subject?: string; surface?: DownloadSurface; forAiCode?: boolean }) {
  const { mac, windows } = SHORTCUTS;
  return (
    <section className="explain-card explain-get" aria-labelledby="explain-get-title">
      <h2 id="explain-get-title">Explain {subject} beside your editor</h2>
      {forAiCode ? (
        <p>
          {`When your AI tool writes ${subject}, select it in any app and press the shortcut. On a Mac that's ${mac.anywhere}, not Command+U (${mac.editor} only works in Cursor and VS Code with the editor bridge). On Windows it's ${windows.anywhere}. Vibe explains it beside your editor, you can ask it why, and Test me checks that you followed. Free for Mac and Windows.`}
        </p>
      ) : (
        <p>
          Unvibe is a free app for Mac and Windows. In the app there is no pasting: select code in any app and press{" "}
          {mac.anywhere} ({windows.anywhere} on Windows).
        </p>
      )}
      <GetUnvibe surface={surface} />
    </section>
  );
}
