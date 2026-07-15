"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Button } from "../Button";

type BillingInterval = "monthly" | "annual";

const plans = [
  {
    name: "Pro",
    monthly: 12,
    annual: 8,
    description: "For one developer who wants a focused explanation allowance.",
    points: ["50 AI explanations each month", "All learning tools stay free", "Five explanation depths"],
    featured: false,
  },
  {
    name: "Team",
    monthly: 8,
    annual: 6,
    description: "For teams that want the same calm learning layer, per person.",
    points: ["50 AI explanations per person, monthly", "All learning tools stay free", "Team billing when available"],
    featured: true,
  },
] as const;

export function Pricing() {
  const [interval, setInterval] = useState<BillingInterval>("monthly");
  const annual = interval === "annual";

  return (
    <section id="pricing" className="container-page py-16 sm:py-24" aria-labelledby="pricing-heading">
      <div className="mx-auto max-w-2xl text-center">
        <span className="inline-flex rounded-pill border border-primary/20 bg-primary-soft px-3.5 py-1 text-fluid-sm font-medium text-primary">
          Pricing
        </span>
        <h2 id="pricing-heading" className="mt-4 text-balance text-fluid-3xl font-semibold tracking-tight text-fg">
          Pay for explanations. Keep learning free.
        </h2>
        <p className="mt-4 text-pretty text-fluid-lg leading-relaxed text-fg-muted">
          Your progress, saved material, comprehension checks, and teaching tools never consume an allowance. Only cloud-generated explanations are metered.
        </p>
      </div>

      <div className="mx-auto mt-8 inline-flex w-full justify-center" role="group" aria-label="Billing interval">
        <div className="inline-flex rounded-pill border border-line bg-surface p-1">
          {(["monthly", "annual"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={interval === value}
              onClick={() => setInterval(value)}
              className={`rounded-pill px-4 py-2 text-fluid-sm font-medium transition-colors ${
                interval === value ? "bg-fg text-bg" : "text-fg-muted hover:text-fg"
              }`}
            >
              {value === "monthly" ? "Monthly" : "Annual"}
              {value === "annual" && <span className="ml-1.5 text-green">Save 33%</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto mt-8 grid max-w-4xl gap-5 md:grid-cols-2">
        {plans.map((plan) => {
          const price = annual ? plan.annual : plan.monthly;
          return (
            <article
              key={plan.name}
              className={`relative rounded-card border bg-surface p-7 sm:p-8 ${
                plan.featured ? "border-primary/50 shadow-soft" : "border-line"
              }`}
            >
              {plan.featured && (
                <span className="absolute right-6 top-6 rounded-pill bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary">
                  Best for teams
                </span>
              )}
              <h3 className="text-fluid-xl font-semibold text-fg">{plan.name}</h3>
              <p className="mt-2 min-h-12 max-w-sm text-fluid-sm leading-relaxed text-fg-muted">{plan.description}</p>
              <p className="mt-6 flex items-end gap-1 text-fg">
                <span className="text-4xl font-semibold tracking-tight">${price}</span>
                <span className="mb-1 text-fluid-sm text-fg-muted">/ person / month</span>
              </p>
              {annual && <p className="mt-1 text-fluid-sm text-fg-muted">Billed annually at ${price * 12} per person.</p>}
              <ul className="mt-7 space-y-3">
                {plan.points.map((point) => (
                  <li key={point} className="flex gap-3 text-fluid-sm text-fg-muted">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-green" aria-hidden="true" />
                    {point}
                  </li>
                ))}
              </ul>
              <Button href="#waitlist" className="mt-8 w-full">
                Join the private beta
              </Button>
            </article>
          );
        })}
      </div>

      <p className="mx-auto mt-7 max-w-2xl text-center text-fluid-sm leading-relaxed text-fg-faint">
        Private-beta access is free while invitations are open. Professional plans for larger organizations are planned; we will publish their limits and pricing before offering them.
      </p>
    </section>
  );
}
