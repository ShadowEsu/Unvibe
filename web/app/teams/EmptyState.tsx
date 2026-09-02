/**
 * First-run state for /teams — nothing connected yet. The CTA is a real
 * anchor to the (future) GitHub App install URL; until env vars are set it
 * routes to a "Contact us" mailto so the button is never dead.
 */

export function TeamsEmpty({ installUrl }: { installUrl: string | null }) {
  return (
    <section className="teams-empty">
      <span className="teams-empty__eyebrow">Unvibe Teams</span>
      <h1>Connect a GitHub organization.</h1>
      <p>
        Unvibe reads pull requests, commits, and CODEOWNERS to show what your team understands, where knowledge
        is concentrated, and which important changes are moving faster than context can keep up. Your code
        never leaves GitHub.
      </p>
      <div className="teams-empty__actions">
        <a
          href={installUrl ?? 'mailto:teams@unvibe.site?subject=Unvibe%20Teams%20early%20access'}
          className="teams-empty__cta"
        >
          {installUrl ? 'Connect GitHub' : 'Request Teams access'}
        </a>
        <a href="mailto:teams@unvibe.site" className="teams-empty__secondary">
          Talk to us first
        </a>
      </div>
      <ul className="teams-empty__what">
        <li><b>Organization Overview</b><span>Understand the team's state in five seconds.</span></li>
        <li><b>PR Intelligence</b><span>Every significant PR becomes a durable knowledge object.</span></li>
        <li><b>Knowledge Risk</b><span>See where context is missing, stale, or concentrated.</span></li>
      </ul>
      <p className="teams-empty__foot">
        Personal Unvibe on your Mac keeps working. Teams adds shared engineering knowledge on top.
      </p>
    </section>
  );
}
