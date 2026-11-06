"use client";

import Link from "next/link";
import { pricingCopy } from "@/lib/pricingCopy";
import { Vibe } from "@/components/paper/Vibe";
import { DiaFoot, DiaNav, DiaRoot } from "./DiaChrome";
import { BtnDot } from "./effects";

/** The live closed-payments copy, word for word (Security 0936). LAB: the closed state only. */
const COPY = pricingCopy(false);
const IRISES_CREDIT = "Irises, Vincent van Gogh, 1889";

/**
 * Direction D pricing (Dia's /pricing: icon, serif H1, three white cards with the middle one raised; no "Most popular",
 * Pro isn't on sale). Hovering or focusing the Pro card fades an inset-0 layer of Van Gogh's Irises over the page
 * (Motion's [data-d-bgswap] CSS, Dia's mechanism); the H1 turns white over it; leaving restores the page.
 */
export function DiaPricing() {
  const h1 = <>{COPY.heading.lead}<em>{COPY.heading.emphasis}</em>{COPY.heading.tail}</>;
  return (
    <DiaRoot className="dp-page">
      <div className="dp__bg" data-d-bgswap="" aria-hidden="true" />
      {/* The credit fades with the painting (its own [data-d-bgswap]) but sits above the cards, so nothing covers it */}
      <span className="dp__credit" data-d-bgswap="" aria-hidden="true">{IRISES_CREDIT}</span>
      <DiaNav active="Pricing" />
      <main id="main" tabIndex={-1} className="dp">
        <header className="dp__head" data-d-enter="">
          <Vibe size={64} follow={false} />
          <h1 className="dp__h1 d-serif" data-d-swap-ink="">
            <span>{h1}</span>
            <span data-d-swap-ink-on="" aria-hidden="true">{h1}</span>
          </h1>
        </header>
        <div className="dp__cards">
          {COPY.plans.map((plan, i) => {
            const pro = plan.id === "pro";
            return (
              <article key={plan.id} className={`dp__card${pro ? " dp__card--pro" : ""}`} aria-labelledby={`dp-${plan.id}`} data-d-enter="" style={{ "--d": `${120 + i * 80}ms` } as React.CSSProperties} {...(pro ? { "data-d-bgswap-trigger": "" } : {})}>
                <div className="dp__top">
                  <h2 id={`dp-${plan.id}`} className="dp__name">{plan.name}</h2>
                  <span className="dp__badge">{plan.badge}</span>
                </div>
                <p className="dp__eyebrow">{plan.eyebrow}</p>
                {plan.price ? <p className="dp__price d-serif">{plan.price}</p> : <p className="dp__price dp__price--note d-serif">{plan.note}</p>}
                <p className="dp__detail">{plan.detail}</p>
                {plan.href.startsWith("mailto:")
                  ? <a className="dp__btn d-btn" href={plan.href}>{plan.cta}<BtnDot /></a>
                  : <Link className={`dp__btn d-btn${pro ? " dp__btn--dark" : ""}`} href={plan.href}>{plan.cta}<BtnDot /></Link>}
                <ul className="dp__feat">{plan.features.map((feature) => <li key={feature}>{feature}</li>)}</ul>
              </article>
            );
          })}
        </div>
        <p className="dp__fine">{COPY.disclosure}</p>
      </main>
      <DiaFoot />
    </DiaRoot>
  );
}
