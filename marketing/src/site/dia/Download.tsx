"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type CSSProperties } from "react";
import { EmailMeLink } from "@/components/paper/EmailMeLink";
import { INSTALL_COPY, InstallBox } from "@/components/paper/InstallBox";
import { track } from "@/lib/analytics";
import { DOWNLOAD_FILES, isDownloadKey, type DownloadKey } from "@/lib/downloadPick";
import { trackDownloadClick } from "@/lib/downloadTracking";
import { Os } from "./bits";
import { D_GET, D_THANKS } from "./content";
import { useVisitor } from "./os";

/**
 * The thank-you state (Preston, 6 Nov): after a one-click download, /beta?dl=<file> opens on the file that started and
 * its first-open steps, InstallBox's live steps word for word (the .dmg isn't notarized, the .exe isn't signed), with
 * the other files one click away ("Intel Mac? / Windows? Download here") and the file again if it didn't start.
 */
function Thanks() {
  const params = useSearchParams();
  const fromUrl = params.get("dl");
  const [picked, setPicked] = useState<DownloadKey | null>(null);
  useEffect(() => setPicked(null), [fromUrl]);
  const key = picked ?? (isDownloadKey(fromUrl) ? fromUrl : null);
  useEffect(() => {
    if (key) document.getElementById("thanks")?.focus({ preventScroll: false });
  }, [key]);
  if (!key) return null;
  const file = DOWNLOAD_FILES[key];
  const copy = INSTALL_COPY[file.os];
  const others = (["mac-arm", "mac-intel", "windows"] as const).filter((k) => k !== key && !(key === "windows" && k === "mac-intel"));
  const label = (k: DownloadKey) => (k === "mac-intel" ? D_THANKS.intel : k === "windows" ? D_THANKS.windows : key === "windows" ? D_THANKS.mac : D_THANKS.arm);
  const get = (k: DownloadKey) => () => {
    trackDownloadClick("beta", DOWNLOAD_FILES[k].os);
    setPicked(k);
  };
  return (
    <section className="dt" id="thanks" tabIndex={-1} aria-labelledby="dt-h" data-os={file.os}>
      <div className="dt__in">
        <p className="d-label d-mono d-left">{D_THANKS.file(file.label)}</p>
        <h2 id="dt-h" className="dt__h d-serif">{D_THANKS.h1}</h2>
        <p className="dt__lede">{file.os === "mac" ? D_THANKS.lede : D_THANKS.ledeWindows}</p>
        <ol className="dt__steps">
          {copy.steps.map((step, i) => {
            const shot = copy.stepShots[i];
            return (
              <li key={step} style={{ "--i": i } as CSSProperties}>
                <span className="dt__n" aria-hidden="true">{i + 1}</span>
                <div>
                  <p>{step}</p>
                  {shot ? (
                    <figure className="dt__shot">
                      {/* eslint-disable-next-line @next/next/no-img-element -- a real screenshot at its native size */}
                      <img src={shot.src} width={shot.width} height={shot.height} alt={shot.alt} decoding="async" />
                      <figcaption className="d-mono">{shot.caption}</figcaption>
                    </figure>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
        <p className="dt__more">
          <a href={file.url} onClick={get(key)}>{D_THANKS.again}</a>
          {others.map((k) => (
            <span key={k}>{label(k)} <a href={DOWNLOAD_FILES[k].url} onClick={get(k)}>{D_THANKS.here}</a></span>
          ))}
          <Link href="/install-help">{D_GET.help} <span aria-hidden="true">→</span></Link>
        </p>
      </div>
    </section>
  );
}

/** The right column: the live InstallBox for this computer (Security D13: the line first, the file second), or the
 * emailed-link form on a phone. */
function Install() {
  const visitor = useVisitor();
  const [intelMac, setIntelMac] = useState(false);
  useEffect(() => {
    if (visitor.device !== "mac") return;
    const uaData = (navigator as Navigator & { userAgentData?: { getHighEntropyValues?: (hints: string[]) => Promise<{ architecture?: string; platform?: string }> } }).userAgentData;
    void uaData?.getHighEntropyValues?.(["architecture", "platform"]).then((v) => {
      if (v.platform === "macOS" && v.architecture === "x86") setIntelMac(true);
    }).catch(() => undefined);
  }, [visitor.device]);
  useEffect(() => {
    if (visitor.known) track("beta_install_viewed", { surface: "page", os: visitor.device === "windows" ? "windows" : "mac" });
  }, [visitor.known, visitor.device]);
  if (visitor.device === "phone") {
    return (
      <div className="dd__phone" id="email-link">
        <p className="ninst__title">Unvibe runs on a Mac or PC.</p>
        <p className="dd__phone-l">Open the email there to install it.</p>
        <EmailMeLink surface="beta_phone" />
      </div>
    );
  }
  return (
    <div id="email-link">
      <InstallBox os={visitor.device === "windows" ? "windows" : "mac"} surface="beta" intelMac={intelMac} guided />
    </div>
  );
}

/**
 * /beta, direction D (plan mock 11; the Aurora prompt's layout): a bubbles panel with "Get Unvibe" and three step
 * pills (ANIMATIONS #32), and the cream right column with the live InstallBox, restyled, never replaced. The
 * thank-you state sits above it after a one-click download.
 */
export function Download() {
  return (
    <>
      <Suspense fallback={null}>
        <Thanks />
      </Suspense>
      <div className="dd" id="install">
        <section className="dd__panel" aria-labelledby="dd-h">
          <div className="dd__bg" aria-hidden="true" />
          <p className="dd__mark" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element -- Vibe, our own mark */}
            <img src="/brand/vibe.svg" width={34} height={34} alt="" />
            <span className="dd__word">Unvibe</span>
          </p>
          <div className="dd__copy">
            <h1 id="dd-h" className="dd__h1 d-serif">{D_GET.h1}</h1>
            <p className="dd__sub">{D_GET.sub}</p>
            <ol className="dd__pills" data-d-pills="">
              {D_GET.steps.map((step, i) => (
                <li key={i} className={i === 0 ? "dd__pill dd__pill--on" : "dd__pill"}>
                  <span className="dd__n">{i + 1}</span>
                  <Os v={step} />
                </li>
              ))}
            </ol>
          </div>
        </section>
        <div className="dd__install">
          <Install />
          <Link className="dd__help" href="/install-help">{D_GET.help} <span aria-hidden="true">→</span></Link>
        </div>
      </div>
    </>
  );
}
