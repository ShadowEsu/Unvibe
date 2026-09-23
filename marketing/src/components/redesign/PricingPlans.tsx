"use client";

import { useEffect, useRef } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/Button";
import { track } from "@/lib/analytics";

const corePlans = [
  { id: "free", name: "Free", badge: "Public beta", eyebrow: "Understand the code in front of you.", price: "$0", detail: "30 free explanations to start. Included cloud models. No card or separate API key.", features: ["Selected-code explanations", "Core explanation levels", "Saved explanations and progress", "On-device secret filtering"], cta: "Download Unvibe", href: "/#install" },
  { id: "pro", name: "Pro", badge: "Individual", eyebrow: "Keep the context, not just the answer.", price: "$10/month", detail: "One developer account, billed monthly. Annual is $90/year (25% off).", features: ["File, diff, and project context", "Five explanation depths", "Follow-up and Test me", "Saved concepts, history, and study"], cta: "Join the Pro waitlist", href: "/?utm_campaign=pro_pricing#waitlist", featured: true },
  { id: "lifetime", name: "Pro Lifetime", badge: "One-time", eyebrow: "Own the personal core.", price: "$80", detail: "One-time. Local and core personal features forever. Checkout from the Unvibe app Plan page.", features: ["Personal understanding loop", "Saved explanations and study", "No monthly Pro bill", "Does not include Teams GitHub intelligence"], cta: "Get Lifetime in the app", href: "/#install" },
  { id: "teams", name: "Teams", badge: "Founding pilot", eyebrow: "Share a workspace and see who reviewed what.", price: "$8/seat/month", detail: "Founding price. 2–20 seats. Shared activity with authorship in the app. Explanation text stays on each device. GitHub intelligence stays Pilot.", features: ["Shared workspace and invites", "Who reviewed what (metadata)", "2–20 founding seats", "GitHub intelligence still Pilot"], cta: "Request Teams seats", href: "mailto:preston@unvibe.site?subject=Unvibe%20Teams%20founding%20pilot&body=Company%20email%3A%20%0ASeats%20wanted%20(2%E2%80%9320)%3A%20%0A%0AWe%20want%20the%20Teams%20founding%20pilot%20(workspace%20%2B%20who%20reviewed%20what)." },
] as const;

const enterprisePlan = {
  id: "enterprise",
  name: "Enterprise",
  badge: "Planned",
  eyebrow: "Govern engineering knowledge across the organization.",
  price: "Starting at $199/month",
  detail: "Conversation pricing. Security, admin, and organization intelligence when those ship.",
  features: [
    "Organization intelligence roadmap",
    "Knowledge policies and administration",
    "Retention and audit controls",
    "Enterprise security roadmap",
  ],
  cta: "Talk about Enterprise",
  href: "mailto:preston@unvibe.site?subject=Unvibe%20Enterprise",
} as const;

type Plan = (typeof corePlans)[number] | typeof enterprisePlan;

const featureGroups = [
  { name: "Personal understanding", rows: [
    ["Selected-code explanations", "Beta", "Included", "Included", "Included"],
    ["Active file, git diff, and project context", "—", "Included", "Included", "Included"],
    ["Five explanation depths, follow-up, and Test me", "Core", "Included", "Included", "Included"],
    ["Saved concepts, history, study, and progress", "Core", "Included", "Included", "Included"],
    ["Local secret filtering and per-repository consent", "Included", "Included", "Included", "Included"],
  ] },
  { name: "Shared engineering knowledge", rows: [
    ["Shared workspace, invites, and who-reviewed-what activity", "—", "—", "Included", "Included"],
    ["Full explanation text shared across seats", "—", "—", "On-device only", "On-device only"],
    ["GitHub organization and repository connection", "—", "—", "Pilot", "Pilot"],
    ["PR, repository, and system understanding", "—", "—", "Pilot", "Pilot"],
    ["Knowledge matrix, freshness, concentration, and risk", "—", "—", "Pilot roadmap", "Pilot roadmap"],
    ["Understanding Gap and transparent recommendations", "—", "—", "Pilot roadmap", "Pilot roadmap"],
    ["Repository onboarding and weekly knowledge brief", "—", "—", "Pilot roadmap", "Pilot roadmap"],
    ["Ask Engineering, architecture context, and AI-change intelligence", "—", "—", "Planned", "Planned"],
  ] },
  { name: "Governance and enterprise", rows: [
    ["Organization intelligence and knowledge governance", "—", "—", "—", "Planned"],
    ["Audit events and configurable retention", "—", "—", "—", "Planned"],
    ["SSO/SAML, SCIM, advanced RBAC, and data residency", "—", "—", "—", "Later"],
    ["BYOK, zero-data-retention routing, VPC, and SLA support", "—", "—", "—", "Later"],
  ] },
] as const;

export function PricingPlans() {
  const trackedView = useRef(false);
  useEffect(() => {
    if (!trackedView.current) {
      trackedView.current = true;
      track("pricing_viewed");
    }
  }, []);

  return (
    <div className="pricing-plans">
      <div className="pricing-plans__intro">
        <p className="paper-meta">Simple monthly pricing</p>
        <h2>Start personal. Add shared intelligence when the team is ready.</h2>
        <p>
          Teams founding-pilot pricing includes a shared workspace and who-reviewed-what activity.
          GitHub-connected understanding dashboards are labeled Pilot or Planned below so you can
          separate the beta from what comes next.
        </p>
      </div>
      <div className="marketing-plan-grid marketing-plan-grid--core">
        {corePlans.map((plan) => (
          <PlanCard key={plan.id} {...plan} />
        ))}
      </div>
      <EnterpriseBand plan={enterprisePlan} />
      <p className="pricing-disclosure">
        Prices are monthly in USD. Teams and Enterprise capabilities are rolling out in phases.
        “Pilot,” “Planned,” and “Later” are not claims of current availability.
      </p>
      <FeatureComparison />
    </div>
  );
}

function PlanCard({
  id,
  name,
  badge,
  eyebrow,
  price,
  detail,
  features,
  cta,
  href,
  featured = false,
}: Plan & { featured?: boolean }) {
  return (
    <article className={`marketing-plan-card${featured ? " featured" : ""}`}>
      <span className="plan-badge">{badge}</span>
      <h3>{name}</h3>
      <p className="plan-kicker">{eyebrow}</p>
      <strong className="marketing-plan-price">{price}</strong>
      <small>{detail}</small>
      <ul>
        {features.map((feature) => (
          <li key={feature}>
            <Check size={15} />
            {feature}
          </li>
        ))}
      </ul>
      <Button
        href={href}
        size="lg"
        className="pricing-button"
        onClick={() => track("plan_cta_clicked", { plan: id })}
      >
        {cta}
      </Button>
    </article>
  );
}

function EnterpriseBand({ plan }: { plan: typeof enterprisePlan }) {
  return (
    <article className="marketing-plan-card marketing-plan-card--enterprise" aria-labelledby="enterprise-plan-title">
      <div className="enterprise-band__lead">
        <span className="plan-badge">{plan.badge}</span>
        <h3 id="enterprise-plan-title">{plan.name}</h3>
        <p className="plan-kicker">{plan.eyebrow}</p>
        <strong className="marketing-plan-price">{plan.price}</strong>
        <small>{plan.detail}</small>
      </div>
      <ul className="enterprise-band__features">
        {plan.features.map((feature) => (
          <li key={feature}>
            <Check size={15} />
            {feature}
          </li>
        ))}
      </ul>
      <div className="enterprise-band__cta">
        <Button
          href={plan.href}
          size="lg"
          className="pricing-button"
          onClick={() => track("plan_cta_clicked", { plan: plan.id })}
        >
          {plan.cta}
        </Button>
      </div>
    </article>
  );
}

function FeatureComparison() {
  return (
    <section className="pricing-comparison" aria-labelledby="feature-comparison-title">
      <div className="paper-center">
        <p className="paper-meta">Complete plan map</p>
        <h2 id="feature-comparison-title">What belongs where—and when.</h2>
      </div>
      <div
        className="pricing-comparison__scroll"
        tabIndex={0}
        aria-label="Plan feature comparison, horizontally scrollable on small screens"
      >
        <table>
          <thead>
            <tr>
              <th scope="col">Capability</th>
              <th scope="col">Free</th>
              <th scope="col">Pro</th>
              <th scope="col">Teams</th>
              <th scope="col">Enterprise</th>
            </tr>
          </thead>
          <tbody>
            {featureGroups.map((group) => (
              <FeatureGroup key={group.name} name={group.name} rows={group.rows} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function FeatureGroup({ name, rows }: { name: string; rows: readonly (readonly string[])[] }) {
  return (
    <>
      <tr className="pricing-comparison__group">
        <th colSpan={5} scope="rowgroup">
          {name}
        </th>
      </tr>
      {rows.map(([feature, ...values]) => (
        <tr key={feature}>
          <th scope="row">{feature}</th>
          {values.map((value, index) => (
            <td key={`${feature}-${index}`}>
              <span className={value === "—" ? "is-empty" : undefined}>{value}</span>
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
