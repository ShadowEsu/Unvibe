import { currentUserId } from '@/lib/session';
import { getStore } from '@/data/store';
import Link from 'next/link';
import { LanguageLogos } from '@/components/LanguageLogos';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const userId = await currentUserId();

  return (
    <>
      <section className="hero">
        <div className="hero__bg" />
        <h1 className="hero__title">
          Understand AI-written code<sup className="hero__super">™</sup>
        </h1>
        <p className="hero__sub">
          Uncode quietly reviews every change, explains it in your project context, and builds your comprehension — so you stay in control.
        </p>
        <div className="hero__logos">
          <LanguageLogos />
        </div>
        {userId ? <HomeStats userId={userId} /> : <SignInPrompt />}
      </section>

      <section className="screenshots">
        <h2 className="section-title">See it in action</h2>
        <div className="screenshots__grid">
          <figure className="screenshots__card">
            <img src="/screenshots/progress-light.webp" alt="Progress dashboard" loading="lazy" className="screenshots__img" />
            <figcaption>Dashboard — progress at a glance</figcaption>
          </figure>
          <figure className="screenshots__card">
            <img src="/screenshots/study-light.webp" alt="Study mode" loading="lazy" className="screenshots__img" />
            <figcaption>Study — review concepts and test yourself</figcaption>
          </figure>
          <figure className="screenshots__card">
            <img src="/screenshots/projects-light.webp" alt="Projects view" loading="lazy" className="screenshots__img" />
            <figcaption>Projects — organisation per repo</figcaption>
          </figure>
          <figure className="screenshots__card">
            <img src="/screenshots/notebook-light.webp" alt="Notebook" loading="lazy" className="screenshots__img" />
            <figcaption>Notebook — save insights as you learn</figcaption>
          </figure>
        </div>
      </section>

      <section className="features">
        <h2 className="section-title">What you get</h2>
        <div className="features__grid">
          <FeatureCard icon="🛡" title="Secret-safe" description="Every context is scanned locally before anything leaves your machine. Your tokens, keys, and private code stay private." />
          <FeatureCard icon="🧠" title="5-level explanations" description="From New to Expert — each change explained at the depth you need, with real code citations." />
          <FeatureCard icon="📚" title="Persistent learning" description="Explanations are saved to your dashboard. Build a personal knowledge base over time." />
          <FeatureCard icon="🎯" title="Comprehension quizzes" description={'Test me generates a targeted question so you can confirm you truly understood the change.'} />
          <FeatureCard icon="🔄" title="Works with any stack" description="TypeScript, Python, Go, Rust, CSS, HTML, PHP, Ruby, C++ and more — Uncode is language-agnostic." />
          <FeatureCard icon="⌨" title="Keyboard-first" description="Every surface is keyboard-operable. No mouse required for the full review loop." />
        </div>
      </section>
    </>
  );
}

function FeatureCard({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <article className="feature-card">
      <span className="feature-card__icon" aria-hidden="true">{icon}</span>
      <h3 className="feature-card__title">{title}</h3>
      <p className="feature-card__desc">{description}</p>
    </article>
  );
}

async function HomeStats({ userId }: { userId: string }) {
  const p = await getStore().profile(userId);
  const tiles: Array<[string, number | string]> = [
    ['Reviews', p.totalReviews],
    ['Understood', p.understood],
    ['Needs review', p.needsReview],
    ['Concepts', p.conceptsUnderstood],
    ['Streak', `${p.currentStreakDays}d`],
  ];
  if (p.totalReviews === 0) {
    return (
      <div className="empty-state">
        <p className="empty-state__title">No reviews yet</p>
        <p>Review some AI-written code in your editor and it will show up here.</p>
      </div>
    );
  }
  return (
    <div className="stat-grid">
      {tiles.map(([label, value]) => (
        <div className="stat-tile" key={label}>
          <div className="stat-tile__value">{value}</div>
          <div className="stat-tile__label">{label}</div>
        </div>
      ))}
    </div>
  );
}

function SignInPrompt() {
  return (
    <div className="sign-in-prompt">
      <p className="sign-in-prompt__text">Sign in to see your personalised dashboard and saved explanations.</p>
      <Link href="/login" className="btn btn--primary">Sign in</Link>
      <span className="sign-in-prompt__sep">or</span>
      <Link href="/signup" className="btn btn--secondary">Create an account</Link>
    </div>
  );
}
