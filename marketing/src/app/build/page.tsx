import type { Metadata } from "next";
import { BuildLive } from "@/components/build/BuildLive";
import { BuildMap } from "@/components/paper/BuildMap";
import { ChangelogList } from "@/components/paper/ChangelogList";
import { JoinWaitlistRow } from "@/components/paper/JoinWaitlistLink";
import { GrowthFollowSum } from "@/components/paper/SocialFollow";
import { Reveal } from "@/components/redesign/Reveal";
import { changelogPreview } from "@/data/milestones";

export const metadata: Metadata = {
  title: "Building Unvibe",
  description: "Follow Unvibe from private beta to public release, live.",
};

export default function BuildPage() {
  return (
    <article className="build-page">
      <header className="paper-photo-band">
        <img src="/hero/golden-gate.png" alt="" />
        <div className="paper-hero__veil" />
        <div className="paper-photo-band__copy">
          <p className="paper-meta">Building in public</p>
          <h1>75% to public release.</h1>
          <p>
            Almost here. Live testing is done. Feedback is done.
          </p>
          <div className="paper-meter" aria-label="75 percent to public release">
            <div className="paper-meter__track">
              <span style={{ width: "75%" }} />
            </div>
            <strong>75%</strong>
          </div>
          <JoinWaitlistRow href="/#waitlist" />
        </div>
      </header>

      <section className="paper-section" id="growth">
        <Reveal className="paper-wrap">
          <div className="paper-center mb-8">
            <p className="paper-meta">Growth</p>
            <h2 className="mt-3">The road so far.</h2>
          </div>
          <GrowthFollowSum />
          <div className="paper-map-frame">
            <BuildMap />
          </div>
        </Reveal>
      </section>

      <section className="paper-section">
        <Reveal className="paper-wrap">
          <BuildLive />
        </Reveal>
      </section>

      <section className="paper-section">
        <Reveal className="paper-wrap">
          <div className="paper-center mb-8">
            <p className="paper-meta">What shipped</p>
            <h2 className="mt-3">The record, newest first.</h2>
            <a href="/releases" className="paper-text-link">Full change log</a>
          </div>
          <ChangelogList items={changelogPreview(5)} />
        </Reveal>
      </section>
    </article>
  );
}
