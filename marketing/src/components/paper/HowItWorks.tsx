import demo from "@/data/demoMedia.json";
import { SHORTCUTS } from "@/lib/shortcuts";
import { FlexAccordion, type FlexAccordionItem } from "@/components/paper/FlexAccordion";
import { TextReveal } from "@/components/paper/TextReveal";

const panelShot = (name: string, alt: string) => ({ src: `/unvibe/real/${name}.webp`, width: 880, height: 1131, alt });
const appShot = (name: string, alt: string) => ({ src: `/unvibe/real/${name}.webp`, width: 1600, height: 1000, alt });

const STEPS: readonly FlexAccordionItem[] = [
  {
    id: "explain",
    label: "Explain",
    title: "Select code. Press the shortcut.",
    body: `Press ${SHORTCUTS.mac.anywhere} on a Mac or ${SHORTCUTS.windows.anywhere} on Windows, in any app. The panel opens beside your editor and the explanation streams in as it is written.`,
    image: panelShot("panel-explained-top", "The Unvibe panel explaining a JavaScript debounce function, with depth buttons along the top"),
  },
  {
    id: "depth",
    label: "Depth",
    title: "Pick how deep it goes.",
    body: "New, Beginner, Intermediate and Advanced are free. Expert is part of Pro. Switch any time and the same code is explained again at that level.",
    image: panelShot("panel-beginner", "The same explanation rewritten at the Beginner depth"),
  },
  {
    id: "ask",
    label: "Ask",
    title: "Ask what still doesn't click.",
    body: "Type a follow-up under the explanation. The answer stays about the code you selected, so you never paste it into a chat.",
    image: panelShot("panel-follow-up", "A typed follow-up question answered in the Unvibe panel"),
  },
  {
    id: "test",
    label: "Test me",
    title: "Check that it stuck.",
    body: "Test me writes one question about this exact code. Miss it and the lesson is saved to revisit later.",
    image: panelShot("panel-test-me", "A multiple-choice Test me question about the debounce function"),
  },
];

const PAGES: readonly FlexAccordionItem[] = [
  {
    id: "today",
    label: "Today",
    title: "Today",
    body: "What you understood, what is due for review, and the next small thing to do.",
    image: appShot("today", "The Unvibe Today page with lines understood, reviews and an Up next list"),
  },
  {
    id: "library",
    label: "Library",
    title: "Library",
    body: "Saved explanations remember the code they explained. Refresh one in Briefs to see if it changed. Shown: Unvibe 0.1.43 with sample lessons, from the product screenshot collection.",
    image: { src: "/press/app/03-library.jpg", width: 2000, height: 1281, alt: "Unvibe 0.1.43 Library with sample lessons and Current or Review labels" },
  },
  {
    id: "briefs",
    label: "Briefs",
    title: "Briefs",
    body: "Point it at a git project to see what changed in your working tree, staged files, the latest commit or a branch.",
    image: appShot("briefs", "The Unvibe Briefs page with working tree, staged, latest commit and branch options"),
  },
  {
    id: "momentum",
    label: "Momentum",
    title: "Momentum",
    body: "Coverage, freshness and your streak, counted from what you actually did on this computer.",
    image: appShot("momentum", "The Unvibe Momentum page with understanding coverage and a streak calendar"),
  },
  {
    id: "quiz",
    label: "Quiz",
    title: "Quiz",
    body: "Pick a saved lesson and check what stayed with you, days after you first read it.",
    image: appShot("quiz", "The Unvibe Quick Quiz page listing a saved Debouncing lesson"),
  },
  {
    id: "privacy",
    label: "Privacy",
    title: "Privacy & Data",
    body: "Every selection is scanned for keys and tokens on your computer before it is sent. Only what you ask about leaves it.",
    image: appShot("settings-privacy", "Unvibe Privacy & Data settings showing the always-on secret scan"),
  },
];

/** The homepage walk-through: the four-step loop in the panel, then the rest of the app. */
export function HowItWorks() {
  return (
    <>
      <section className="paper-section hiw" id="product" aria-labelledby="hiw-title">
        <div className="paper-wrap">
          <TextReveal
            className="hiw__statement"
            text="AI writes the code in seconds. Unvibe helps you understand every line before you ship it."
            accent={["understand", "every", "line"]}
          />
        </div>
        <div className="paper-wrap u-sheet">
          <div className="hiw__head">
            <p className="paper-meta">How it works</p>
            <h2 id="hiw-title" className="mt-3">Four steps, <em>one panel.</em></h2>
          </div>
          <FlexAccordion items={STEPS} shape="tall" label="How Unvibe works, step by step" />
        </div>
      </section>

      <section className="paper-section hiw hiw--pages" aria-labelledby="pages-title">
        <div className="paper-wrap u-sheet">
          <div className="hiw__head">
            <p className="paper-meta">The rest of the app</p>
            <h2 id="pages-title" className="mt-3">Where it <em>sticks.</em></h2>
          </div>
          <FlexAccordion items={PAGES} shape="wide" label="Pages in the Unvibe app" />
          <p className="hiw__note">Recorded on a {demo.platform} with Unvibe {demo.version}, except Library: Unvibe 0.1.43 with sample lessons.</p>
        </div>
      </section>
    </>
  );
}
