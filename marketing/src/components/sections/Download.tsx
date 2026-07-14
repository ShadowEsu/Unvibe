const MAC_URL =
  "https://github.com/ShadowEsu/Unvibe/releases/download/v1.0.0/Unvibe-1.0.0-arm64.dmg";
const WIN_URL =
  "https://github.com/ShadowEsu/Unvibe/releases/download/v1.0.0/Unvibe-Setup-1.0.0.exe";

export function Download() {
  return (
    <section id="download" className="container-page py-16 sm:py-20">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-fluid-sm font-medium uppercase tracking-[0.14em] text-fg-faint">
          Version 1.0.0
        </p>
        <h2 className="mt-3 text-balance text-fluid-3xl font-semibold tracking-tight text-fg">
          Download Unvibe free
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-pretty text-fluid-lg leading-relaxed text-fg-muted">
          Desktop app for Mac and Windows. Drag the Mac app into Applications, or
          run the Windows installer. Unsigned beta builds may need a right-click
          Open the first time.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <a
            href={MAC_URL}
            className="inline-flex h-[3.25rem] items-center justify-center rounded-pill bg-primary px-7 text-fluid-base font-medium text-on-primary shadow-soft transition-colors hover:bg-primary-strong"
          >
            Download for Mac
          </a>
          <a
            href={WIN_URL}
            className="inline-flex h-[3.25rem] items-center justify-center rounded-pill border border-line-strong bg-surface px-7 text-fluid-base font-medium text-fg transition-colors hover:bg-surface-2"
          >
            Download for Windows
          </a>
        </div>
        <p className="mt-5 text-fluid-sm text-fg-faint">
          Mac Apple Silicon · Windows x64 · Free · No account required to install
        </p>
      </div>
    </section>
  );
}
