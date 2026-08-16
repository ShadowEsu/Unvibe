import {
  INSTAGRAM_URL,
  LINKEDIN_URL,
  SOCIAL_FOLLOWERS,
  SUPPORT_EMAIL,
  TIKTOK_URL,
  X_URL,
  supportMailto,
} from "@/lib/contact";

function XMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M14.1 10.35 22.05 1.5h-1.88l-6.9 7.68L7.77 1.5H1.5l8.33 11.72L1.5 22.5h1.88l7.28-8.1 5.81 8.1H22.5L14.1 10.35Zm-2.58 2.86-.84-1.17L4.06 2.86h2.89l5.4 7.5.84 1.17 7.03 9.77h-2.89l-5.81-8.09Z"
      />
    </svg>
  );
}

function LinkedInMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M5.41 3.75a1.78 1.78 0 1 0 0 3.56 1.78 1.78 0 0 0 0-3.56ZM7.12 20.25H3.7V8.9h3.42V20.25ZM12.2 8.9h3.28v1.55h.05c.46-.87 1.58-1.79 3.25-1.79 3.48 0 4.12 2.29 4.12 5.27v6.32h-3.42v-5.6c0-1.34-.03-3.06-1.87-3.06-1.86 0-2.15 1.45-2.15 2.95v5.71H12.2V8.9Z"
      />
    </svg>
  );
}

function InstagramMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        d="M8 3.75h8A4.25 4.25 0 0 1 20.25 8v8A4.25 4.25 0 0 1 16 20.25H8A4.25 4.25 0 0 1 3.75 16V8A4.25 4.25 0 0 1 8 3.75Z"
      />
      <circle cx="12" cy="12" r="3.4" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="17.2" cy="6.8" r="0.85" fill="currentColor" />
    </svg>
  );
}

function TikTokMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M16.2 3.2c.7 2.4 2.4 4.3 4.8 5v3.05a8.2 8.2 0 0 1-4.8-1.5v6.55A6.7 6.7 0 1 1 9.4 9.6c.4 0 .8.04 1.2.12v3.2A3.55 3.55 0 1 0 13.9 16V3.2h2.3Z"
      />
    </svg>
  );
}

function MailMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        d="M4.5 6.75h15A1.75 1.75 0 0 1 21.25 8.5v9A1.75 1.75 0 0 1 19.5 19.25h-15A1.75 1.75 0 0 1 2.75 17.5v-9A1.75 1.75 0 0 1 4.5 6.75Z"
      />
      <path fill="none" stroke="currentColor" strokeWidth="1.5" d="m4 7.5 8 6.2 8-6.2" />
    </svg>
  );
}

function ColorXMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="var(--logo-x)"
        d="M14.1 10.35 22.05 1.5h-1.88l-6.9 7.68L7.77 1.5H1.5l8.33 11.72L1.5 22.5h1.88l7.28-8.1 5.81 8.1H22.5L14.1 10.35Zm-2.58 2.86-.84-1.17L4.06 2.86h2.89l5.4 7.5.84 1.17 7.03 9.77h-2.89l-5.81-8.09Z"
      />
    </svg>
  );
}

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

function ColorTikTokMark() {
  const note = "M16.2 3.2c.7 2.4 2.4 4.3 4.8 5v3.05a8.2 8.2 0 0 1-4.8-1.5v6.55A6.7 6.7 0 1 1 9.4 9.6c.4 0 .8.04 1.2.12v3.2A3.55 3.55 0 1 0 13.9 16V3.2h2.3Z";
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="var(--logo-tiktok-cyan)" transform="translate(-1.15 0.55)" d={note} />
      <path fill="var(--logo-tiktok-pink)" transform="translate(1.15 -0.45)" d={note} />
      <path fill="var(--logo-tiktok)" d={note} />
    </svg>
  );
}

const socialProfiles = [
  { name: "X", href: X_URL, Mark: XMark },
  { name: "LinkedIn", href: LINKEDIN_URL, Mark: LinkedInMark },
  { name: "Instagram", href: INSTAGRAM_URL, Mark: InstagramMark },
  { name: "TikTok", href: TIKTOK_URL, Mark: TikTokMark },
] as const;

const followSum = [
  { name: "X", href: X_URL, Mark: ColorXMark },
  { name: "LinkedIn", href: LINKEDIN_URL, Mark: ColorLinkedInMark },
  { name: "Instagram", href: INSTAGRAM_URL, Mark: ColorInstagramMark },
  { name: "TikTok", href: TIKTOK_URL, Mark: ColorTikTokMark },
] as const;

interface SocialFollowLinksProps {
  includeMail?: boolean;
  className?: string;
}

export function SocialFollowLinks({ includeMail = false, className = "paper-footer__social" }: SocialFollowLinksProps) {
  return (
    <div className={className}>
      {socialProfiles.map(({ name, href, Mark }) => (
        <a key={name} href={href} target="_blank" rel="noopener noreferrer" aria-label={`Unvibe on ${name}`}>
          <Mark />
        </a>
      ))}
      {includeMail ? (
        <a href={supportMailto} aria-label={`Email ${SUPPORT_EMAIL}`}>
          <MailMark />
        </a>
      ) : null}
    </div>
  );
}

export function GrowthFollowSum() {
  return (
    <div className="paper-keys-stage">
      <div className="paper-follow" aria-label={`${SOCIAL_FOLLOWERS} followers across X, LinkedIn, Instagram, and TikTok`}>
        {followSum.map((profile, index) => {
          const Mark = profile.Mark;
          return (
            <span key={profile.name} className="paper-follow__item">
              {index > 0 ? <span className="paper-keys__plus" aria-hidden="true">+</span> : null}
              <a className="paper-follow__mark" href={profile.href} target="_blank" rel="noopener noreferrer" aria-label={`Unvibe on ${profile.name}`}>
                <Mark />
              </a>
            </span>
          );
        })}
        <span className="paper-keys__plus" aria-hidden="true">=</span>
        <div className="paper-follow__total">
          <strong>{SOCIAL_FOLLOWERS}</strong>
          <span>followers</span>
        </div>
      </div>
      <p className="paper-caption">Current total across those four.</p>
    </div>
  );
}
