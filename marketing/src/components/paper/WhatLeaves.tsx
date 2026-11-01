/**
 * "What leaves your computer." (Design W4): what an explanation sends and what stays, as two lists.
 * Every item restates /privacy ("What Unvibe processes", "Secret filtering", "Consent and the cloud",
 * "Storage") or the FAQ's "What gets sent to the AI?"; whatLeaves.test.ts checks each against those pages.
 */
export const SENT: readonly string[] = [
  "The code you selected and its language",
  "Its file path inside your project, when Unvibe knows it, never the full path on your computer",
  "The name of the project folder",
  "Any question you type",
  "On Pro, up to two files the selection imports (the first 4,000 characters of each)",
  "Git changes, only when you ask a Brief to explain them",
  "Without an account, a random install ID with your system and the app version, so free explanations can be counted. Signed in, your sign-in token instead",
];

export const KEPT: readonly string[] = [
  "Your repo. It is never uploaded.",
  "Keys and tokens. Unvibe scans for them on your computer and stops a known key before anything is sent.",
  "Your Library: the code, the explanations and your notes. Signed in, only a record of each lesson syncs, not its code.",
  "Your keystrokes and screen. Unvibe reads only the selection.",
];

export function WhatLeaves() {
  return (
    <section className="paper-section" id="what-leaves" aria-labelledby="what-leaves-title">
      <div className="paper-wrap u-sheet">
        <div className="sec-head">
          <p className="paper-meta">Privacy</p>
          <h2 id="what-leaves-title">What leaves <em>your computer.</em></h2>
          <p className="paper-lead">Only what you ask about. The privacy policy has the full detail.</p>
        </div>
        <div className="leaves">
          <div className="leaves__col">
            <h3>Sent to write the explanation</h3>
            <ul className="leaves__list">
              {SENT.map((item) => (
                <li key={item}><UpIcon />{item}</li>
              ))}
            </ul>
            <p className="leaves__who">During the beta, Anthropic&apos;s Claude API writes the explanation.</p>
          </div>
          <div className="leaves__col">
            <h3>Stays on your computer</h3>
            <ul className="leaves__list">
              {KEPT.map((item) => (
                <li key={item}><HomeIcon />{item}</li>
              ))}
            </ul>
          </div>
        </div>
        <p className="leaves__foot">
          <span>AI can be wrong, even when it sounds sure. Each explanation sits next to its code so you can check it.</span>{" "}
          <a className="paper-text-link" href="/privacy">Privacy policy</a>
        </p>
      </div>
    </section>
  );
}

function UpIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 19V6" />
      <path d="m6 11 6-6 6 6" />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="13" rx="2" />
      <path d="M8 21h8" />
    </svg>
  );
}
