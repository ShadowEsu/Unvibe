import { Arrive } from "@/components/paper/Arrive";
import { CountUp } from "@/components/paper/CountUp";
import { FlexAccordion } from "@/components/paper/FlexAccordion";
import { STEPS } from "@/data/howItWorks";

const appShot = (name: string, alt: string) => ({ src: `/unvibe/real/${name}.webp`, width: 1600, height: 1000, alt });

/** The app's pages as a captionless rail: a screenshot and its name, nothing else. */
const PAGES = [
  { label: "Today", image: appShot("today", "The Unvibe Today page") },
  { label: "Library", image: { src: "/press/app/03-library.jpg", width: 2000, height: 1281, alt: "Unvibe 0.1.43 Library with sample lessons" } },
  { label: "Briefs", image: appShot("briefs", "The Unvibe Briefs page") },
  { label: "Momentum", image: appShot("momentum", "The Unvibe Momentum page") },
  { label: "Quick Quiz", image: appShot("quiz", "The Unvibe Quick Quiz page") },
] as const;

/** The homepage walk-through: the four-step loop in the panel, then a rail of the app's pages. */
export function HowItWorks() {
  return (
    <>
      <section className="paper-section hiw" id="product" aria-labelledby="hiw-title">
        <Arrive className="arrive--plate">
          <div className="paper-wrap u-sheet">
            <div className="hiw__head">
              <h2 id="hiw-title">
                <CountUp name="hiw-steps" value={4} /> steps, <CountUp name="hiw-panel" value={1} /> <mark className="u-mark">panel</mark>.
              </h2>
            </div>
            <FlexAccordion items={STEPS} shape="tall" label="How Unvibe works, step by step" />
          </div>
        </Arrive>
      </section>

      <section className="paper-section hiw hiw--pages" aria-label="Pages in the Unvibe app">
        <Arrive className="arrive--plate">
          <div className="paper-wrap u-sheet">
            <ul className="hiw-rail">
              {PAGES.map((page) => (
                <li key={page.label} className="hiw-rail__item">
                  <figure>
                    {/* eslint-disable-next-line @next/next/no-img-element -- pre-sized screenshots, lazy below the fold */}
                    <img src={page.image.src} width={page.image.width} height={page.image.height} alt={page.image.alt} loading="lazy" decoding="async" />
                    <figcaption>{page.label}</figcaption>
                  </figure>
                </li>
              ))}
            </ul>
          </div>
        </Arrive>
      </section>
    </>
  );
}
