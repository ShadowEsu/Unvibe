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
            Download Unvibe free for Mac and Windows, or join the waitlist for
            updates as we ship the next releases.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button href="#download" size="lg">
              Download free
            </Button>
            <Button href="#waitlist" variant="secondary" size="lg">
              Join waitlist
            </Button>
          </div>
          <p className="mt-5 text-fluid-sm text-fg-faint">
            Completely free · Mac + Windows · No credit card · No pricing wall
          </p>
        </div>
      </div>
    </section>
  );
}
