"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { track } from "@/lib/analytics";
import { AI_MAINTENANCE, AI_MAINTENANCE_NOTE } from "@/lib/aiMaintenance";
import { PRICING } from "@/lib/pricing";
import { trackDownloadPageClick } from "@/lib/downloadTracking";
import type { PlanCopy, PricingCopy } from "@/lib/pricingCopy";

/** A plan button click; the download ones also count as a download-page click from pricing. */
export function trackPlanCta(plan: { id: string; href: string }): void {
  track("plan_cta_clicked", { plan: plan.id });
  if (plan.href === "/beta") trackDownloadPageClick("pricing");
}

/** "$9 a month, or $81 a year" (Design round 06): both intervals on the card, no toggle. */
function price(plan: PlanCopy): { amount: string; per: string | null } {
  if (plan.id === "pro") return { amount: `$${PRICING.proMonthly}`, per: `a month, or $${PRICING.proAnnual} a year` };
  if (plan.id === "teams") return { amount: `$${PRICING.teamsSeatMonthly}`, per: `a seat a month, or $${PRICING.teamsSeatAnnual} a year` };
  return { amount: plan.price, per: null };
}

/**
 * /pricing in Design package-1106's layout (round 06 pricing.html), over the live pricingCopy for either billing
 * state. The heading's first sentence is the H1 and the rest leads the line under it. While payments are closed the
 * Pro card has no button and no "try it today" line (Council R07: next to "Not on sale yet" it read as an offer).
 */
export function PricingCards({ copy, paymentsOpen }: { copy: PricingCopy; paymentsOpen: boolean }) {
  const trackedView = useRef(false);
  useEffect(() => {
    if (trackedView.current) return;
    trackedView.current = true;
    track("pricing_viewed");
  }, []);
  const heading = `${copy.heading.lead}${copy.heading.emphasis}${copy.heading.tail}`;
  const cut = heading.indexOf(". ") + 1;
  const title = cut > 0 ? heading.slice(0, cut) : heading;
  const rest = cut > 0 ? `${heading.slice(cut + 1)} ` : "";
  return (
    <div className="ap-r6">
      <header className="ap-r6__intro">
        <h1 id="pricing-title">{title}</h1>
        <p>{rest}Free needs no card and no API key.</p>
      </header>
      <h2 className="sr-only">Plans</h2>
      <div className="ap-r6__plans">
        {copy.plans.map((plan) => {
          const { amount, per } = price(plan);
          const showCta = paymentsOpen || plan.id !== "pro";
          return (
            <article key={plan.id} id={plan.id} className={`ap-r6__plan${plan.id === "free" ? " is-main" : ""}`}>
              <span className="ap-r6__tag">{plan.note ? `${plan.badge} · ${plan.note}` : plan.badge}</span>
              <h3>{plan.name}</h3>
              <p className="ap-r6__what">{plan.eyebrow}</p>
              <p className="ap-r6__price">{amount}{per ? <small> {per}</small> : null}</p>
              <p className="ap-r6__fine">{plan.detail}</p>
              <ul>{plan.features.map((feature) => <li key={feature}>{feature}</li>)}</ul>
              {showCta ? (
                plan.primary
                  ? <Link href={plan.href} className="lx-btn lx-btn--solid sx-btn ap-r6__cta" onClick={() => trackPlanCta(plan)}>{plan.cta}</Link>
                  : <a href={plan.href} className="lx-btn ap-r6__cta ap-r6__cta--ghost" onClick={() => trackPlanCta(plan)}>{plan.cta}</a>
              ) : null}
            </article>
          );
        })}
      </div>
      {AI_MAINTENANCE ? <p className="ap-r6__small" role="status">{AI_MAINTENANCE_NOTE}</p> : null}
      <p className="ap-r6__small">{copy.disclosure}</p>
    </div>
  );
}
