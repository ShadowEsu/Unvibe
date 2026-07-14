import { Button } from "../Button";

export function FinalCta() {
  return (
    <section className="container-page py-16 sm:py-20">
      <div className="relative overflow-hidden rounded-card border border-line bg-surface px-6 py-14 text-center sm:px-12 sm:py-16">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgb(var(--primary)/0.12),_transparent_55%),radial-gradient(ellipse_at_bottom_right,_rgb(var(--blue)/0.10),_transparent_50%)]"
          aria-hidden="true"
        />
        <div className="relative mx-auto max-w-2xl">
          <h2 className="text-balance text-fluid-3xl font-semibold tracking-tight text-fg">
            Ship with AI. Learn what you shipped.
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-pretty text-fluid-lg leading-relaxed text-fg-muted">
            Unvibe is free for everyone in the Mac beta. Join the waitlist if you
            want to understand agent-written code without leaving your editor.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button href="#waitlist" size="lg">
              Join free waitlist
            </Button>
            <Button href="#demo" variant="secondary" size="lg">
              Watch the demo
            </Button>
          </div>
          <p className="mt-5 text-fluid-sm text-fg-faint">
            Completely free · Mac first · No credit card · No pricing wall
          </p>
        </div>
      </div>
    </section>
  );
}
