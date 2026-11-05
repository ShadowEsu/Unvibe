import { Arrive } from "@/components/paper/Arrive";
import { ExpandRows } from "@/components/paper/ExpandRows";

/**
 * "What leaves your computer." (Design W4): what an explanation sends and what stays, as two lists.
 * Every item restates /privacy ("What Unvibe processes", "Secret filtering", "Consent and the cloud",
 * "Storage") or the FAQ's "What gets sent to the AI?"; whatLeaves.test.ts checks each against those pages.
 */
export const SENT: readonly string[] = [
  "The code you selected, or the file you choose, and its language",
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
  "Your keystrokes and screen. Unvibe never records them.",
];

/** Both lists word for word, closed by default (Security: collapsed is fine); the Anthropic line and the AI line stay visible. */
export function WhatLeaves() {
  return (
    <section className="n-sec n-wrap nleaves" id="what-leaves" aria-labelledby="what-leaves-title">
      <Arrive className="n-head">
        <h2 id="what-leaves-title">What leaves your computer.</h2>
        <p className="n-lead">Only what&apos;s needed to explain what you ask about.</p>
      </Arrive>
      <div>
        <ExpandRows
          rows={[
            { id: "sent", question: "Sent to write the explanation", answer: <ul>{SENT.map((item) => <li key={item}>{item}</li>)}</ul> },
            { id: "kept", question: "Stays on your computer", answer: <ul>{KEPT.map((item) => <li key={item}>{item}</li>)}</ul> },
          ]}
        />
        <div className="nleaves__notes">
          <p className="n-note">During the beta, Anthropic&apos;s Claude API writes the explanation, unless you add your own provider key in the app.</p>
          <p className="n-note">
            AI can be wrong, even when it sounds sure. Each explanation sits next to its code so you can check it.{" "}
            <a className="n-link" href="/privacy">Privacy policy</a>
          </p>
        </div>
      </div>
    </section>
  );
}
