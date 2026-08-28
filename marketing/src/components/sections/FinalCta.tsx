import { Button } from "../Button";

export function FinalCta() {
  return (
    <section className="container-page section-editorial">
      <div className="relative overflow-hidden rounded-card border border-line bg-surface px-6 py-16 text-center sm:px-12 sm:py-20">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_50%_40%_at_50%_30%,rgb(var(--primary)/0.10),transparent_60%),radial-gradient(ellipse_40%_30%_at_80%_70%,rgb(var(--blue)/0.06),transparent_50%)]"
          aria-hidden="true"
        />
        <div className="relative mx-auto max-w-2xl">
          <p className="mb-4 text-fluid-sm font-medium uppercase tracking-[0.18em] text-primary">
            Ship with confidence
          </p>
          <h2 className="text-balance font-display text-fluid-3xl font-book leading-[1.08] tracking-tight text-fg">
            Ship with AI.
            <br />
            <span className="text-primary">Learn what you shipped.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-lg text-pretty text-fluid-lg leading-relaxed text-fg-muted">
            Unvibe is free for everyone in the Mac private beta.
            No credit card. No pricing page. No catch.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button href="#waitlist" size="lg">
              Join the free beta
            </Button>
            <Button href="#demo" variant="secondary" size="lg">
              Watch the demo
            </Button>
          </div>
          <p className="mt-5 text-fluid-sm text-fg-faint">
            Mac first &middot; No credit card &middot; No charge during private beta
          </p>
        </div>
      </div>
    </section>
  );
}
