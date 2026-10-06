import { DownloadRow } from "@/components/paper/DownloadLink";

const REASONS: Array<[string, string, string]> = [
  ["lime", "It's free right now.", "The whole beta is free: no card, no API key, 30 explanations on us."],
  ["sky", "AI code piles up fast.", "Every week you ship code you don't understand, the cleanup gets bigger. Starting today costs you nothing."],
  ["sun", "Your learning compounds.", "Every explanation you save shows up again in your library and gets flagged when the code changes. Start later, remember less."],
  ["lilac", "You shape what we build.", "Instant explain on highlight, Ask the codebase and GitHub reviews are decided by what early users ask for."],
];

/** Four honest reasons to download today, then the buttons. */
export function WhyNow() {
  return (
    <div className="why">
      <div className="why__grid">
        {REASONS.map(([tone, title, body], index) => (
          <article key={title} className={`why__card why__card--${tone}`}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <h3>{title}</h3>
            <p>{body}</p>
          </article>
        ))}
      </div>
      <div className="why__cta"><DownloadRow /></div>
    </div>
  );
}
