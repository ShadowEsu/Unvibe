import Link from "next/link";

export default function NotFound() {
  return (
    <section className="nf">
      <img src="/hero/golden-gate.png" alt="" />
      <div className="paper-hero__veil" />
      <div className="nf__card paper-glass">
        <p className="paper-meta">Error 404</p>
        <h1>This page was vibe coded out of existence.</h1>
        <p className="nf__code">
          <span>const</span> page = routes.find(r =&gt; r.path === <em>&quot;here&quot;</em>); <span>{"// undefined"}</span>
        </p>
        <p>Let us take you somewhere that exists.</p>
        <div className="nf__actions">
          <Link href="/" className="nf__btn nf__btn--ink">Back home</Link>
          <Link href="/beta" className="nf__btn">Download Unvibe</Link>
        </div>
      </div>
    </section>
  );
}
