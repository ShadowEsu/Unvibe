"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { InstallBox } from "@/components/paper/InstallBox";
import { Vibe } from "@/components/paper/Vibe";
import { useVisitor } from "@/site/parts";
import { DiaFoot, DiaRoot } from "./DiaChrome";
import { D_GET } from "./content";

/**
 * Direction D /download (plan mock 11; the Aurora prompt's layout): a bubbles panel on the left with "Get Unvibe" and
 * three step pills (Motion's [data-d-pills] stagger), and on the right the LIVE InstallBox, restyled and never
 * replaced (Security D13): the Terminal / PowerShell line first, then the file with its first-open steps open.
 */
export function DiaDownload() {
  const visitor = useVisitor();
  const os = visitor.device === "windows" ? "windows" : "mac";
  return (
    <DiaRoot className="dd-page">
      <main id="main" tabIndex={-1} className="dd">
        <section className="dd__panel" aria-labelledby="dd-h">
          <div className="dd__bg" aria-hidden="true" />
          <Link href="/lab/d" className="dd__mark" aria-label="Unvibe home">
            <Vibe size={34} follow={false} />
            <span className="dd__word">Unvibe</span>
          </Link>
          <div className="dd__copy">
            <h1 id="dd-h" className="dd__h1 d-serif">{D_GET.h1}</h1>
            <p className="dd__sub">{D_GET.sub}</p>
            <ol className="dd__pills" data-d-pills="">
              {D_GET.steps.map((step, i) => (
                <li key={i} className={i === 0 ? "dd__pill dd__pill--on" : "dd__pill"} style={{ "--i": i } as CSSProperties}>
                  <span className="dd__n">{i + 1}</span>
                  {typeof step === "string" ? step : <><span className="lx-mac">{step.mac}</span><span className="lx-win">{step.windows}</span></>}
                </li>
              ))}
            </ol>
          </div>
        </section>
        <div className="dd__install" data-d-enter="">
          <InstallBox os={os} surface="beta" intelMac={os === "mac" && visitor.intelMac} guided />
          <Link className="dd__help" href="/install-help">{D_GET.help} <span aria-hidden="true">→</span></Link>
        </div>
      </main>
      <DiaFoot />
    </DiaRoot>
  );
}
