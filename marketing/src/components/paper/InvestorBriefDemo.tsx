"use client";

import { AutoPlayVideo } from "@/components/paper/AutoPlayVideo";

/** Short product pass for the investors page. */
export function InvestorBriefDemo() {
  return (
    <section className="container-page investor-brief" aria-label="Brief product demo">
      <div className="investor-brief__copy">
        <p className="launch-label">Product in ninety seconds</p>
        <h2>A brief look at Unvibe in the editor.</h2>
        <p>
          Select code, get a streamed explanation with project context, then keep what you learned.
          Full Cursor walkthrough is on the homepage.
        </p>
      </div>
      <div className="paper-video investor-brief__video">
        <AutoPlayVideo
          src="/videos/unvibe-brief-demo.mp4"
          poster="/videos/unvibe-brief-demo-poster.jpg"
          label="Brief Unvibe product demo"
        />
      </div>
    </section>
  );
}
