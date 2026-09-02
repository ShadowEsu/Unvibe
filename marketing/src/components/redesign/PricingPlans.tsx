"use client";

import { useEffect, useRef } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/Button";
import { track } from "@/lib/analytics";

const plans = [
  { id: "free", name: "Free", badge: "Private beta", eyebrow: "Understand the code in front of you.", price: "$0", detail: "30 explanations. No card or separate API key.", features: ["Selected-code explanations", "Core explanation levels", "Saved explanations and progress", "On-device secret filtering"], cta: "Get the beta", href: "/#install" },
  { id: "pro", name: "Pro", badge: "Individual", eyebrow: "Keep the context, not just the answer.", price: "$15/month", detail: "One developer account, billed monthly.", features: ["File, diff, and project context", "Five explanation depths", "Follow-up and Test me", "Saved concepts, history, and study"], cta: "Join the Pro waitlist", href: "/?utm_campaign=pro_pricing#waitlist", featured: true },
  { id: "teams", name: "Teams", badge: "Founding pilot", eyebrow: "Turn code changes into shared understanding.", price: "$15/seat/month", detail: "Founding Teams price. Built around GitHub.", features: ["Shared, verified engineering context", "PR and repository understanding", "Coverage, freshness, and risk", "Onboarding and weekly knowledge briefs"], cta: "Join the Teams pilot", href: "/?utm_campaign=teams_pilot#waitlist" },
  { id: "enterprise", name: "Enterprise", badge: "Planned", eyebrow: "Govern engineering knowledge across the organization.", price: "$500/month", detail: "Includes 20 seats. Then $15 per additional seat.", features: ["Organization intelligence", "Knowledge policies and administration", "Retention and audit controls", "Enterprise security roadmap"], cta: "Talk about Enterprise", href: "mailto:preston@unvibe.site?subject=Unvibe%20Enterprise" },
] as const;

const featureGroups = [
  { name: "Personal understanding", rows: [
    ["Selected-code explanations", "Beta", "Included", "Included", "Included"],
    ["Active file, git diff, and project context", "—", "Included", "Included", "Included"],
    ["Five explanation depths, follow-up, and Test me", "Core", "Included", "Included", "Included"],
    ["Saved concepts, history, study, and progress", "Core", "Included", "Included", "Included"],
    ["Local secret filtering and per-repository consent", "Included", "Included", "Included", "Included"],
  ] },
  { name: "Shared engineering knowledge", rows: [
    ["GitHub organization and repository connection", "—", "—", "Pilot", "Pilot"],
    ["Shared and human-verified engineering context", "—", "—", "Pilot", "Pilot"],
    ["Team overview and member context profiles", "—", "—", "Pilot roadmap", "Pilot roadmap"],
    ["PR, repository, and system understanding", "—", "—", "Pilot roadmap", "Pilot roadmap"],
    ["Knowledge matrix, freshness, concentration, and risk", "—", "—", "Pilot roadmap", "Pilot roadmap"],
    ["Understanding Gap and transparent recommendations", "—", "—", "Pilot roadmap", "Pilot roadmap"],
    ["Repository onboarding and weekly knowledge brief", "—", "—", "Pilot roadmap", "Pilot roadmap"],
    ["Ask Engineering, architecture context, and AI-change intelligence", "—", "—", "Planned", "Planned"],
  ] },
  { name: "Governance and enterprise", rows: [
    ["Organization intelligence and knowledge governance", "—", "—", "—", "Planned"],
    ["Teams, permissions, policies, integrations, and billing admin", "—", "—", "—", "Planned"],
    ["Audit events and configurable retention", "—", "—", "—", "Planned"],
    ["SSO/SAML, SCIM, advanced RBAC, and data residency", "—", "—", "—", "Later"],
    ["BYOK, zero-data-retention routing, VPC, and SLA support", "—", "—", "—", "Later"],
  ] },
] as const;

export function PricingPlans() {
  const trackedView = useRef(false);
  useEffect(() => { if (!trackedView.current) { trackedView.current = true; track("pricing_viewed"); } }, []);
  return (
    <div className="pricing-plans">
      <div className="pricing-plans__intro"><p className="paper-meta">Simple monthly pricing</p><h2>Start personal. Add shared intelligence when the team is ready.</h2><p>Teams is founding-pilot pricing. Roadmap features are labeled honestly below so you can separate today’s beta from what comes next.</p></div>
      <div className="marketing-plan-grid">{plans.map((plan) => <PlanCard key={plan.id} {...plan} />)}</div>
      <p className="pricing-disclosure">Prices are monthly in USD. Teams and Enterprise capabilities are rolling out in phases. “Pilot,” “Planned,” and “Later” are not claims of current availability.</p>
      <FeatureComparison />
    </div>
  );
}

function PlanCard({ id, name, badge, eyebrow, price, detail, features, cta, href, featured = false }: (typeof plans)[number] & { featured?: boolean }) {
  return <article className={`marketing-plan-card${featured ? " featured" : ""}`}><span className="plan-badge">{badge}</span><h3>{name}</h3><p className="plan-kicker">{eyebrow}</p><strong className="marketing-plan-price">{price}</strong><small>{detail}</small><ul>{features.map((feature) => <li key={feature}><Check size={15} />{feature}</li>)}</ul><Button href={href} size="lg" className="pricing-button" onClick={() => track("plan_cta_clicked", { plan: id })}>{cta}</Button></article>;
}

function FeatureComparison() {
  return <section className="pricing-comparison" aria-labelledby="feature-comparison-title"><div className="paper-center"><p className="paper-meta">Complete plan map</p><h2 id="feature-comparison-title">What belongs where—and when.</h2></div><div className="pricing-comparison__scroll" tabIndex={0} aria-label="Plan feature comparison, horizontally scrollable on small screens"><table><thead><tr><th scope="col">Capability</th><th scope="col">Free</th><th scope="col">Pro</th><th scope="col">Teams</th><th scope="col">Enterprise</th></tr></thead><tbody>{featureGroups.map((group) => <FeatureGroup key={group.name} name={group.name} rows={group.rows} />)}</tbody></table></div></section>;
}

function FeatureGroup({ name, rows }: { name: string; rows: readonly (readonly string[])[] }) {
  return <><tr className="pricing-comparison__group"><th colSpan={5} scope="rowgroup">{name}</th></tr>{rows.map(([feature, ...values]) => <tr key={feature}><th scope="row">{feature}</th>{values.map((value, index) => <td key={`${feature}-${index}`}><span className={value === "—" ? "is-empty" : undefined}>{value}</span></td>)}</tr>)}</>;
}
