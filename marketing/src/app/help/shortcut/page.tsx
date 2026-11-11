import type { Metadata } from "next";
import Link from "next/link";
import { Vibe } from "@/components/paper/Vibe";
import { SUPPORT_EMAIL } from "@/lib/contact";
import { pageMetadata } from "@/lib/pageMeta";
import { SHORTCUTS } from "@/lib/shortcuts";
import { HELP_SHOTS, HelpShot } from "../HelpShot";
import "../help.css";

const { mac, windows } = SHORTCUTS;

export const metadata: Metadata = pageMetadata({
  path: "/help/shortcut",
  title: `${mac.anywhere} does nothing? Fix the Unvibe shortcut on Mac and Windows`,
  absolute: true,
  description: `Pressed ${mac.anywhere} (${windows.anywhere} on Windows) and nothing happened, or the panel opened without your code? Every cause we know of, and its fix, for Mac and Windows.`,
});

/**
 * Help for a shortcut that does nothing. Each symptom is what the shipped app shows (checked against the
 * v0.1.49 source: app/src/main/main.ts startReview and registerShortcut, app/src/renderer/widget/widget.tsx's
 * empty and paste states, app/src/renderer/shared/limitOffer.ts, companion.tsx Settings). Notices the app
 * may also show come second: they can be skipped (notify.ts) and fade after a few seconds. Screenshots are
 * real macOS 15 captures (HelpShot.tsx).
 */
export default function ShortcutHelpPage() {
  return (
    <article className="fos-page">
      <header className="fos-page__head">
        <Vibe size={96} />
        <div>
          <p className="pstats__eyebrow">Help</p>
          <h1>Nothing happens when I press {mac.anywhere}.</h1>
          <p className="fos-page__lead">
            Unvibe&apos;s shortcut copies the code you selected and explains it in a panel beside your editor. If pressing it does
            nothing, or the panel opens without your code (it says <b>Ready when you are</b>), go down this list.
          </p>
        </div>
      </header>

      <section className="verify" aria-labelledby="keys-title">
        <h2 id="keys-title">First: the right keys, with Unvibe running</h2>
        <ul className="help-list">
          <li><b>Mac:</b> {mac.anywhere}. That&apos;s the Control key, not Command.</li>
          <li><b>Windows:</b> {windows.anywhere}. Plain {windows.editor} only works in VS Code and Cursor after you add the editor bridge in Unvibe&apos;s <b>Settings › Integrations</b>.</li>
          <li><b>Select the code first.</b> Highlight a few lines in any app, then press the shortcut. With nothing selected, the panel opens without your code and explains nothing.</li>
          <li><b>Unvibe has to be running.</b> Its icon sits in the Mac menu bar (top right) or the Windows notification area. Click it to open Unvibe (on a Mac, then choose <b>Open Unvibe</b>). If it isn&apos;t there, open Unvibe from Applications or the Start menu.</li>
        </ul>
      </section>

      <section className="verify" aria-labelledby="mac-title">
        <h2 id="mac-title">On a Mac</h2>
        <ul className="help-list">
          <li>
            <b>The panel opens with a paste box and a Turn on the shortcut button.</b> macOS hasn&apos;t allowed Accessibility for
            Unvibe, so it can&apos;t copy your selection. This also happens after some updates. <Link href="/help/accessibility">Allow
            Accessibility</Link>, one switch. Until then, copy the code (⌘C) and paste it into that box: it explains it the same way.
          </li>
          <li>
            <b>You pressed Don&apos;t Allow when macOS asked to let Unvibe control System Events.</b> macOS asks once, a few seconds
            after you finish Unvibe&apos;s setup, or the first time you press {mac.anywhere} if that comes first. Unvibe uses System Events to copy your selection, so after a Don&apos;t Allow the panel opens without your code, and
            macOS doesn&apos;t ask again. Open <b>System Settings › Privacy &amp; Security › Automation</b>, find <b>Unvibe</b>, and
            switch on <b>System Events</b>. Then select the code and press {mac.anywhere} again.
            <div className="help-shots">
              <HelpShot {...HELP_SHOTS.question} />
              <HelpShot {...HELP_SHOTS.automation} />
            </div>
          </li>
        </ul>
      </section>

      <section className="verify" aria-labelledby="win-title">
        <h2 id="win-title">On Windows</h2>
        <ul className="help-list">
          <li><b>Check the keys:</b> {windows.anywhere}, all three together. Windows has no permission to allow.</li>
          <li>
            <b>You selected code, but the panel opens without it.</b> Some apps don&apos;t let Unvibe copy the selection
            (Unvibe may also say &ldquo;Couldn&apos;t copy from&rdquo; that app). Copy the code yourself (Ctrl+C, or Ctrl+Insert in a
            terminal) and press <b>Explain my clipboard</b> in the panel.
          </li>
        </ul>
      </section>

      <section className="verify" aria-labelledby="both-title">
        <h2 id="both-title">On both</h2>
        <ul className="help-list">
          <li>
            <b>Pressing it does nothing at all, and no panel opens.</b> Another app may own the keys (Unvibe may say &ldquo;That
            shortcut is in use by another app.&rdquo; when it opens). Open <b>Settings › General</b>, click the shortcut next to
            <b> Activation shortcut</b>, and press a different combination. If Unvibe says it&apos;s taken or invalid, try another.
          </li>
          <li>
            <b>Sending is switched off.</b> If you turned off <b>Send code to …</b> in <b>Settings › Privacy &amp; Data</b> (it names
            Anthropic (Claude) unless you added your own AI key), nothing is sent and the shortcut is off too. Switch it back on, and
            Unvibe asks you once before it sends code.
          </li>
          <li>
            <b>The panel says Session paused.</b> Your free explanations are used up. Signed out, the free explanations on this computer
            don&apos;t refill: sign in to keep going on the Free plan, which refills every month. Signed in, the panel shows the date they
            refill. <Link href="/faq#free">How the free allowance works</Link>.
          </li>
        </ul>
      </section>

      <p className="fos-page__help">
        Still stuck? Email <a href={`mailto:${SUPPORT_EMAIL}?subject=Unvibe%20shortcut%20help`}>{SUPPORT_EMAIL}</a> with a screenshot,
        your Unvibe version (bottom of Settings) and your Mac or Windows version. Installing for the first time?{" "}
        <Link href="/install-help">Install help</Link>. Last checked with Unvibe 0.1.49.
      </p>
    </article>
  );
}
