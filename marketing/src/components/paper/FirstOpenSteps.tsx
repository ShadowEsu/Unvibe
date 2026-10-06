"use client";

import { useState } from "react";
import { BETA_INSTALL_COMMAND, BETA_WINDOWS_INSTALL_COMMAND } from "@/lib/betaOffer";

type Os = "mac" | "windows";

const REPAIR = "xattr -cr /Applications/Unvibe.app && codesign --force --deep --sign - /Applications/Unvibe.app && open /Applications/Unvibe.app";

function Copy({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="fos__cmd">
      <code>{text}</code>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard.writeText(text).then(() => {
            setDone(true);
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
 * How to open Unvibe the first time. Unvibe is not notarized by Apple yet, so macOS 15+ asks
 * for one approval in System Settings, and Windows SmartScreen asks once. The Terminal and
 * PowerShell installs skip both because command line downloads are not quarantined.
 */
export function FirstOpenSteps({ initialOs = "mac", compact = false }: { initialOs?: Os; compact?: boolean }) {
  const [os, setOs] = useState<Os>(initialOs);
  return (
    <div className={compact ? "fos fos--compact" : "fos"}>
      <div className="fos__tabs" role="tablist" aria-label="Your computer">
        <button type="button" role="tab" aria-selected={os === "mac"} className={os === "mac" ? "is-on" : ""} onClick={() => setOs("mac")}>Mac</button>
        <button type="button" role="tab" aria-selected={os === "windows"} className={os === "windows" ? "is-on" : ""} onClick={() => setOs("windows")}>Windows</button>
      </div>

      {os === "mac" ? (
        <>
          <section className="fos__card fos__card--fast">
            <p className="fos__tag">Fastest, no warnings</p>
            <h3>Paste one line in Terminal</h3>
            <p>Open Terminal (press ⌘ Space, type Terminal), paste this, press Return. It picks the right build for your Mac, quits any old Unvibe, installs and opens it.</p>
            <Copy text={BETA_INSTALL_COMMAND} label="install command" />
          </section>

          <section className="fos__card">
            <p className="fos__tag">Or with the download</p>
            <ol>
              <li><b>Open the .dmg</b> you downloaded and drag <b>Unvibe</b> onto <b>Applications</b>. If it asks, choose <b>Replace</b>.</li>
              <li><b>Open Unvibe</b> from Applications. macOS shows <i>&ldquo;Unvibe Not Opened&rdquo;</i> because Unvibe is not verified by Apple yet. Press <b>Done</b>.</li>
              <li>Open <b>System Settings</b>, then <b>Privacy &amp; Security</b>. Scroll down to <i>&ldquo;Unvibe was blocked&rdquo;</i> and press <b>Open Anyway</b>, then enter your Mac password.</li>
              <li>That&apos;s it. You only do this once, and future versions update themselves.</li>
            </ol>
            <p className="fos__note">On macOS 14 or older you can instead right click Unvibe in Applications and choose <b>Open</b>.</p>
          </section>

          <section className="fos__card">
            <p className="fos__tag">If it says &ldquo;damaged&rdquo;</p>
            <p>That was a bug in older downloads. Get the newest one, or paste this in Terminal to fix the copy you have:</p>
            <Copy text={REPAIR} label="repair command" />
            <p className="fos__note">Using an older Intel Mac? Make sure you downloaded the Intel build. The Terminal line above picks it for you.</p>
          </section>
        </>
      ) : (
        <>
          <section className="fos__card fos__card--fast">
            <p className="fos__tag">Fastest</p>
            <h3>Paste one line in PowerShell</h3>
            <p>Open Windows PowerShell (Start, type PowerShell), paste this, press Enter.</p>
            <Copy text={BETA_WINDOWS_INSTALL_COMMAND} label="install command" />
          </section>
          <section className="fos__card">
            <p className="fos__tag">Or with the download</p>
            <ol>
              <li><b>Run the installer</b> you downloaded.</li>
              <li>If a blue <i>&ldquo;Windows protected your PC&rdquo;</i> box appears, press <b>More info</b>, then <b>Run anyway</b>. It shows because Unvibe is new and not yet signed with a paid certificate.</li>
              <li>Unvibe opens and stays in your taskbar. Future versions update themselves.</li>
            </ol>
            <p className="fos__note">If your browser warns about the download, choose <b>Keep</b>.</p>
          </section>
        </>
      )}
    </div>
  );
}
