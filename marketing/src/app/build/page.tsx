import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BuildLive } from "@/components/build/BuildLive";
import { BUILD_ROADMAP } from "@/lib/buildStatus";
import { milestones } from "@/data/milestones";

export const metadata: Metadata = {
  title: "Building Unvibe",
  description: "Follow Unvibe from private beta to public release, live.",
};

export default function BuildPage() {
  return (
    <article className="build-page">
      <header className="container-page build-hero">
        <div>
          <p className="launch-label">Building in public</p>
          <h1>55% to<br />public release.</h1>
          <p>
            Unvibe is between private-beta feedback and wider live testing. This page
            shows the honest stage and the work behind the August 7 private-beta release.
          </p>
        </div>
        <div className="build-meter" aria-label="55 percent to public release">
          <div><span style={{ width: "55%" }} /></div>
          <strong>55%</strong>
        </div>
      </header>

      <section className="container-page build-roadmap" aria-label="Product roadmap">
        {BUILD_ROADMAP.map((stage) => (
          <div
            key={stage.label}
            className={`${stage.complete ? "complete" : ""}${"current" in stage && stage.current ? " current" : ""}`}
          >
            <span />
            <p>{stage.label}</p>
          </div>
        ))}
      </section>

      <section className="container-page build-live-wrap">
        <BuildLive />
      </section>

      <section className="container-page subpage-product-visual" aria-label="Unvibe sign-in and learning experience">
        <Image
          src="/product-shots/sign-in-carry-learning.png"
          alt="Unvibe sign-in experience with purple and orange ambient lighting"
          width={2294}
          height={1536}
          sizes="(max-width: 1280px) 100vw, 1216px"
        />
      </section>

      <section className="container-page build-log">
        <div className="build-log__intro">
          <p className="launch-label">Milestones</p>
          <h2>What has actually shipped.</h2>
          <p>Product, infrastructure, company, and distribution milestones—kept in one readable record.</p>
          <Link href="/releases">Open full release history <ArrowRight size={14} /></Link>
        </div>
        <div className="build-log__list">
          {milestones.slice(0, 6).map((item) => (
            <article key={`${item.date}-${item.title}`}>
              <time>{item.date}</time>
              <span>{item.category}</span>
              <h3>{item.title}</h3>
              <p>{item.summary}</p>
            </article>
          ))}
        </div>
      </section>
    </article>
  );
}
