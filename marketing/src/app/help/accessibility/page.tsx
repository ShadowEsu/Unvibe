import type { Metadata } from "next";
import Link from "next/link";
import { Vibe } from "@/components/paper/Vibe";
import { SUPPORT_EMAIL } from "@/lib/contact";
import { pageMetadata } from "@/lib/pageMeta";
import { SHORTCUTS } from "@/lib/shortcuts";

const { mac, windows } = SHORTCUTS;

export const metadata: Metadata = pageMetadata({
  path: "/help/accessibility",
  title: `Allow Accessibility so ${mac.anywhere} works in Unvibe on a Mac`,
  absolute: true,
  description: `Why Unvibe asks for macOS Accessibility, how to switch it on in System Settings › Privacy & Security › Accessibility, and what to do when it still says Not allowed yet.`,
});

/**
 * The one macOS permission the shortcut needs. Steps and quoted wording are the shipped app's (checked against the
 * v0.1.49 source: app/src/renderer/companion/companion.tsx PermRow and setup step 4,
 * app/src/renderer/shared/shortcutGuide.tsx, app/src/main/main.ts repairAccessibilityAfterUpdate). No screenshots
 * until QA's macOS 15 captures of 0.1.49 land.
 */
export default function AccessibilityHelpPage() {
  return (
    <article className="fos-page">
      <header className="fos-page__head">
        <Vibe size={96} />
        <div>
          <p className="pstats__eyebrow">Help</p>
          <h1>Allow Accessibility so {mac.anywhere} works.</h1>
          <p className="fos-page__lead">
            On a Mac, Unvibe needs one macOS permission, Accessibility, to copy the code you select when you press {mac.anywhere}.
            You can use Unvibe without it: paste code into Unvibe instead. Windows needs no permission; its shortcut is {windows.anywhere}.
          </p>
        </div>
      </header>

      <section className="verify" aria-labelledby="why-title">
        <h2 id="why-title">What it&apos;s for</h2>
        <p>
          In the app&apos;s words: Unvibe uses it &ldquo;only to copy the code you selected when you press Control+U, then sends that code
          to Anthropic (Claude) through Unvibe to explain it. It never reads your keystrokes or your screen.&rdquo;
        </p>
      </section>

      <section className="verify" aria-labelledby="steps-title">
        <h2 id="steps-title">Switch it on</h2>
        <ol>
          <li>
            In Unvibe, open <b>Settings</b> (bottom of the sidebar), then <b>General</b>, and press <b>Allow Accessibility</b>. During
            setup, the last step&apos;s <b>Turn on the shortcut</b> button does the same.
          </li>
          <li>macOS opens <b>System Settings › Privacy &amp; Security › Accessibility</b>.</li>
          <li>Find <b>Unvibe</b> in the list and switch it on. macOS may ask for your password.</li>
          <li>Come back to Unvibe. The screen updates by itself and says <b>Allowed</b>.</li>
        </ol>
        <p>Then select code in any app and press {mac.anywhere}.</p>
      </section>

      <section className="verify" aria-labelledby="stuck-title">
        <h2 id="stuck-title">Switched it on, but it still says Not allowed yet</h2>
        <p>
          macOS is holding an old Unvibe entry from a previous version. In Unvibe&apos;s <b>Settings › General</b>, press
          <b> Allow Accessibility</b>, then <b>Fix it</b> under it. Switch Unvibe on again in the list that opens, then press
          <b> Restart Unvibe</b>. (While setup&apos;s shortcut step waits for the switch, the same two buttons sit under
          <b> Switched it on and nothing changed?</b>)
        </p>
      </section>

      <section className="verify" aria-labelledby="update-title">
        <h2 id="update-title">The shortcut stopped after an update</h2>
        <p>
          After an update, if {mac.anywhere} opens a paste box and a <b>Turn on the shortcut</b> button instead of explaining your code,
          macOS dropped the old permission (Unvibe may also say &ldquo;Unvibe updated. To use the shortcut again, open Settings,
          General, and press Allow Accessibility.&rdquo;). Do the steps above once more.
        </p>
      </section>

      <section className="verify" aria-labelledby="off-title">
        <h2 id="off-title">Turn it off</h2>
        <p>
          Open <b>System Settings › Privacy &amp; Security › Accessibility</b> and switch Unvibe off. {mac.anywhere} then
          can&apos;t copy your selection, and pasting code into Unvibe keeps working.
        </p>
      </section>

      <p className="fos-page__help">
        Allowed, and {mac.anywhere} still does nothing? <Link href="/help/shortcut">Every other cause</Link>. Still stuck? Email{" "}
        <a href={`mailto:${SUPPORT_EMAIL}?subject=Unvibe%20Accessibility%20help`}>{SUPPORT_EMAIL}</a> with a screenshot and your
        macOS version. Last checked with Unvibe 0.1.49.
      </p>
    </article>
  );
}
