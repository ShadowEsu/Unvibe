"use client";

import { useEffect, useState } from "react";
import { track } from "@/lib/analytics";
import { BETA_INSTALL_COMMAND, BETA_WINDOWS_INSTALL_COMMAND } from "@/lib/betaOffer";
import { BETA_WINDOWS_ASSET } from "@/lib/betaInstallScript";
import { visitorInstallOs } from "@/lib/shortcuts";

type Os = "mac" | "windows";

const TABS: ReadonlyArray<{ os: Os; label: string }> = [
  { os: "mac", label: "Mac" },
  { os: "windows", label: "Windows" },
];

function Copy({ text, label, onCopied }: { text: string; label: string; onCopied?: () => void }) {
  const [done, setDone] = useState(false);
  return (
    <div className="fos__cmd">
      <code>{text}</code>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard.writeText(text).then(() => {
            setDone(true);
            onCopied?.();
            window.setTimeout(() => setDone(false), 1600);
          }).catch(() => undefined);
        }}
        aria-label={`Copy ${label}`}
      >
        {done ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}

/**
 * How to open Unvibe the first time. Unvibe is not notarized by Apple yet, so macOS 15+ needs
 * Open Anyway in Privacy & Security, and Windows SmartScreen needs Run anyway. The Terminal and
 * PowerShell installs skip both because command line downloads are not quarantined.
 *
 * The server renders the Mac panel; without a caller's `initialOs` it then switches to the
 * visitor's own computer. The tabs are links to their panels: without JavaScript both panels
 * show, so the Windows tab still leads to the Windows steps. With `surface`, the tabs and Copy
 * buttons send `beta_install_os_selected` and `beta_install_copied` for that surface.
 */
export function FirstOpenSteps({ initialOs, compact = false, surface }: { initialOs?: Os; compact?: boolean; surface?: "install_help" }) {
  const [os, setOs] = useState<Os>(initialOs ?? "mac");
  useEffect(() => {
    if (!initialOs) setOs(visitorInstallOs(navigator.userAgent, navigator.maxTouchPoints));
  }, [initialOs]);
  const select = (next: Os) => {
    setOs(next);
    if (surface) track("beta_install_os_selected", { os: next, surface });
  };
  const copied = surface ? () => track("beta_install_copied", { os, surface }) : undefined;
  return (
    <div className={compact ? "fos fos--compact" : "fos"}>
      <div className="fos__tabs" role="tablist" aria-label="Your computer">
        {TABS.map((tab) => (
          <a
            key={tab.os}
            id={`fos-tab-${tab.os}`}
            href={`#fos-${tab.os}`}
            role="tab"
            aria-selected={os === tab.os}
            aria-controls={`fos-${tab.os}`}
            className={os === tab.os ? "is-on" : undefined}
            onClick={(event) => {
              event.preventDefault();
              select(tab.os);
            }}
            onKeyDown={(event) => {
              if (event.key !== " ") return;
              event.preventDefault();
              select(tab.os);
            }}
          >
            {tab.label}
          </a>
        ))}
      </div>
      <noscript>
        <style>{".fos__panel[hidden]{display:grid}.fos noscript{display:none}"}</style>
      </noscript>

      <div id="fos-mac" className="fos__panel" role="tabpanel" aria-labelledby="fos-tab-mac" hidden={os !== "mac"}>
        <section className="fos__card fos__card--fast">
          <p className="fos__tag">Fastest, no warnings</p>
          <h3>Paste one line in Terminal</h3>
          <p>Open Terminal (press ⌘ Space, type Terminal), paste this, press Return. It picks the right build for your Mac, quits any old Unvibe, installs and opens it.</p>
          <Copy text={BETA_INSTALL_COMMAND} label="install command" onCopied={copied} />
        </section>

        <section className="fos__card">
          <p className="fos__tag">Or with the download</p>
          <ol>
            <li><b>Open the .dmg</b> you downloaded and drag <b>Unvibe</b> onto <b>Applications</b>. If it asks, choose <b>Replace</b>.</li>
            <li><b>Open Unvibe</b> from Applications. macOS shows <i>&ldquo;Unvibe Not Opened&rdquo;</i> because Unvibe is not verified by Apple yet. Press <b>Done</b>.</li>
            <li>Open <b>System Settings</b>, click <b>Privacy &amp; Security</b>, and scroll down to <b>Security</b>. Press <b>Open Anyway</b>, confirm when macOS asks again, then enter your Mac password. The button stays for about an hour after you try to open Unvibe. If it&apos;s gone, open Unvibe again first.</li>
            <li>That&apos;s it. You only do this once, and future versions update themselves.</li>
          </ol>
          <p className="fos__note">On macOS 14 or older you can instead Control-click (right-click) Unvibe in Applications, choose <b>Open</b>, then press <b>Open</b> again.</p>
        </section>

        <section className="fos__card">
          <p className="fos__tag">If it says &ldquo;damaged&rdquo;</p>
          <p>That was a bug in older downloads. Delete Unvibe from Applications, then get the newest one with the Terminal line above.</p>
          <p className="fos__note">Using an older Intel Mac? Make sure you downloaded the Intel build. The Terminal line above picks it for you.</p>
        </section>
      </div>

      <div id="fos-windows" className="fos__panel" role="tabpanel" aria-labelledby="fos-tab-windows" hidden={os !== "windows"}>
        <section className="fos__card fos__card--fast">
          <p className="fos__tag">Fastest</p>
          <h3>Paste one line in PowerShell</h3>
          <p>Open Windows PowerShell (Start, type PowerShell), paste this, press Enter. It installs Unvibe, adds it to your Start menu and opens it.</p>
          <Copy text={BETA_WINDOWS_INSTALL_COMMAND} label="install command" onCopied={copied} />
        </section>
        <section className="fos__card">
          <p className="fos__tag">Or with the download</p>
          <ol>
            <li>If your browser warns about the download, keep it. In Edge, press <b>…</b> next to the download, then <b>Keep</b>, then <b>Show more</b>, then <b>Keep anyway</b>.</li>
            <li>Run <b>{BETA_WINDOWS_ASSET}</b>, the file you downloaded.</li>
            <li>If a blue <i>&ldquo;Windows protected your PC&rdquo;</i> box appears, press <b>More info</b>, then <b>Run anyway</b>. It shows because Unvibe is new and not yet signed with a paid certificate.</li>
            <li>Unvibe opens and stays in your taskbar. Future versions update themselves.</li>
          </ol>
          <p className="fos__note">No <b>Run anyway</b> button? Work and school PCs can remove it. If Smart App Control is turned on (Windows 11), it blocks unsigned apps like Unvibe and can&apos;t make an exception for one app. Email <a href="mailto:hello@unvibe.site?subject=Unvibe%20Windows%20install">hello@unvibe.site</a> and we&apos;ll help.</p>
        </section>
      </div>
    </div>
  );
}
