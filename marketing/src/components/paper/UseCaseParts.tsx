import Link from "next/link";
import type { ReactNode } from "react";
import { faqItems } from "@/data/faq";
import { explainLanguage, explainPages } from "@/lib/explainPages";
import { breadcrumbJsonLd, jsonLdScript } from "@/lib/jsonLd";
import { PRICING } from "@/lib/pricing";
import { pricingCopy } from "@/lib/pricingCopy";
import { SHORTCUTS } from "@/lib/shortcuts";
import { USE_CASES_INDEX, pathForUseCase, useCases, type UseCase } from "@/lib/useCases";

/**
 * The parts every /use-cases/<slug> page shares. Every product sentence here is the site's own:
 * the steps restate HowItWorks.tsx and the FAQ, What is sent is the FAQ answer, and Free and Pro
 * are /pricing's plan cards (pricingCopy), so a change there changes these pages too.
 */

const accuracyAnswer = faqItems.find((item) => item.id === "accuracy")?.answer ?? "";
const sentAnswer = faqItems.find((item) => item.id === "sent")?.answer ?? "";

/** Breadcrumb (with its JSON-LD), H1 and the page's opening paragraph. */
export function UseCaseHead({ useCase, heading, children }: { useCase: UseCase; heading: string; children: ReactNode }) {
  return (
    <div className="explain-head">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdScript(
            breadcrumbJsonLd([
              { name: "Home", path: "/" },
              { name: "Use cases", path: USE_CASES_INDEX.path },
              { name: useCase.name, path: pathForUseCase(useCase) },
            ]),
          ),
        }}
      />
      <nav aria-label="Breadcrumb" className="explain-crumb">
        <Link href="/">Home</Link> <span aria-hidden="true">/</span> <Link href={USE_CASES_INDEX.path}>Use cases</Link>{" "}
        <span aria-hidden="true">/</span> {useCase.name}
      </nav>
      <h1>{heading}</h1>
      {children}
    </div>
  );
}

/** A short real code sample. Lines never wrap (a wrapped line reads as two lines of code): the block scrolls
 *  sideways on narrow screens, and a fade on its right edge shows there is more until you reach the end (Design).
 *  The scroller is a named region that takes focus, so the keyboard can scroll it and a screen reader announces it
 *  (code and pre can't carry a name). */
export function UseCaseSample({ file, code }: { file: string; code: string }) {
  return (
    <figure className="use-sample">
      <figcaption>{file}</figcaption>
      <div className="use-sample__frame">
        <div className="use-sample__scroll" role="region" aria-label={`${file}, code sample, scrolls sideways`} tabIndex={0}>
          <code className="os-cmd">{code}</code>
        </div>
      </div>
    </figure>
  );
}

/** Select, shortcut, depth, follow-up, Test me. `select` and `ask` are the page's own example. */
export function UseCaseSteps({ select, ask, children }: { select: ReactNode; ask: string; children?: ReactNode }) {
  return (
    <section className="explain-card" aria-labelledby="use-steps">
      <h2 id="use-steps">Doing it with Unvibe</h2>
      <ol className="explain-notes">
        <li>{select}</li>
        <li>
          Press {SHORTCUTS.mac.anywhere} on a Mac or {SHORTCUTS.windows.anywhere} on Windows. The panel opens beside your
          editor and the explanation streams in as it is written.
        </li>
        <li>
          Pick a depth. New, Beginner, Intermediate and Advanced are free; Expert is part of Pro. Switch any time and the
          same code is explained again at that depth.
        </li>
        <li>
          Type a follow-up under the explanation, such as &ldquo;{ask}&rdquo; The answer stays about the code you
          selected.
        </li>
        <li>
          Press Test me. It writes a question about this exact code, and up to three if you want more. Miss one and the
          lesson is saved to revisit later.
        </li>
      </ol>
      {children}
      <p>{accuracyAnswer}</p>
    </section>
  );
}

/** What is sent, and Free and Pro in /pricing's words for the current payments state. */
export function UseCaseFacts({ paymentsOpen }: { paymentsOpen: boolean }) {
  const { plans } = pricingCopy(paymentsOpen);
  const free = plans.find((plan) => plan.id === "free");
  const pro = plans.find((plan) => plan.id === "pro");
  return (
    <section className="explain-card" aria-labelledby="use-sent">
      <h2 id="use-sent">What leaves your computer</h2>
      <p>The code you select is sent to a cloud model to write the explanation. {sentAnswer}</p>
      <p>
        <Link className="paper-text-link" href="/privacy">Privacy policy</Link>
      </p>

      <h2 id="use-plans">Free and Pro</h2>
      {free ? (
        <>
          <p><strong>Free.</strong> {free.detail}</p>
          <ul className="explain-notes">
            {free.features.map((feature) => <li key={feature}>{feature}</li>)}
          </ul>
        </>
      ) : null}
      {pro ? (
        <>
          <p>
            <strong>Pro, ${PRICING.proMonthly} a month or ${PRICING.proAnnual} a year.</strong> {pro.detail}
          </p>
          <ul className="explain-notes">
            {pro.features.map((feature) => <li key={feature}>{feature}</li>)}
          </ul>
        </>
      ) : null}
      <p>
        <Link className="paper-text-link" href="/pricing">Pricing</Link>
      </p>
    </section>
  );
}

/** The other use cases, this case's explain page (useCases.ts explainId) and /resources, as plain text links. */
export function UseCaseMore({ current }: { current: UseCase }) {
  const explain = explainPages.find(({ id }) => id === current.explainId);
  if (!explain) throw new Error(`Use case "${current.slug}": no explain page "${current.explainId}"`);
  const { name } = explainLanguage(explain);
  return (
    <nav className="explain-card" aria-labelledby="use-more">
      <h2 id="use-more">Read next</h2>
      <ul className="explain-notes">
        {useCases
          .filter((entry) => entry.slug !== current.slug)
          .map((entry) => (
            <li key={entry.slug}>
              <Link className="paper-text-link" href={pathForUseCase(entry)}>{entry.name}</Link>
            </li>
          ))}
        <li>
          <Link className="paper-text-link" href={`/explain/${explain.id}`}>Explain {name} code in your browser</Link>
        </li>
        <li>
          <Link className="paper-text-link" href="/resources">Resources: quickstart, the five depths and shortcuts</Link>
        </li>
      </ul>
    </nav>
  );
}
