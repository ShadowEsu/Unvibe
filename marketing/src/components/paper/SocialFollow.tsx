import { INSTAGRAM_URL, LINKEDIN_URL } from "@/lib/contact";

function ColorLinkedInMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="var(--logo-linkedin)"
        d="M5.41 3.75a1.78 1.78 0 1 0 0 3.56 1.78 1.78 0 0 0 0-3.56ZM7.12 20.25H3.7V8.9h3.42V20.25ZM12.2 8.9h3.28v1.55h.05c.46-.87 1.58-1.79 3.25-1.79 3.48 0 4.12 2.29 4.12 5.27v6.32h-3.42v-5.6c0-1.34-.03-3.06-1.87-3.06-1.86 0-2.15 1.45-2.15 2.95v5.71H12.2V8.9Z"
      />
    </svg>
  );
}

function ColorInstagramMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <linearGradient id="unvibeIgFill" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="var(--logo-ig-gold)" />
          <stop offset="0.5" stopColor="var(--logo-ig-pink)" />
          <stop offset="1" stopColor="var(--logo-ig-violet)" />
        </linearGradient>
      </defs>
      <rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5.2" fill="url(#unvibeIgFill)" />
      <circle cx="12" cy="12" r="4.1" fill="none" stroke="var(--snow)" strokeWidth="1.7" />
      <circle cx="16.7" cy="7.3" r="1" fill="var(--snow)" />
    </svg>
  );
}

const followSum = [
  { name: "LinkedIn", href: LINKEDIN_URL, Mark: ColorLinkedInMark },
  { name: "Instagram", href: INSTAGRAM_URL, Mark: ColorInstagramMark },
] as const;

export function GrowthFollowLinks() {
  return (
    <div className="paper-keys-stage">
      <div className="paper-follow">
        {followSum.map((profile) => {
          const Mark = profile.Mark;
          return (
            <a key={profile.name} className="paper-follow__mark" href={profile.href} target="_blank" rel="noopener noreferrer" aria-label={`Unvibe on ${profile.name}`}>
              <Mark />
            </a>
          );
        })}
      </div>
      <p className="paper-caption">Follow the build on LinkedIn and Instagram.</p>
    </div>
  );
}
