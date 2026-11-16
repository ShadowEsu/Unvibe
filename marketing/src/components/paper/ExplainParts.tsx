import { GetUnvibe } from "@/components/paper/GetUnvibe";
import type { DownloadSurface } from "@/lib/downloadTracking";
import { SHORTCUTS } from "@/lib/shortcuts";

/** Page copy from explainPages.ts: text between `backticks` renders as code. */
export function Prose({ text }: { text: string }) {
  return <>{text.split("`").map((part, i) => (i % 2 === 1 ? <code key={i}>{part}</code> : part))}</>;
}

/** The download step at the end of every /explain and /use-cases page. `subject` is what the page explains ("Python code"). */
export function ExplainDownload({ subject = "code", surface = "explain" }: { subject?: string; surface?: DownloadSurface }) {
  return (
    <section className="explain-card explain-get" aria-labelledby="explain-get-title">
      <h2 id="explain-get-title">Explain {subject} beside your editor</h2>
      <p>
        Unvibe is a free app for Mac and Windows. In the app there is no pasting: select code in any app and press{" "}
        {SHORTCUTS.mac.anywhere} ({SHORTCUTS.windows.anywhere} on Windows).
      </p>
      <GetUnvibe surface={surface} />
    </section>
  );
}
