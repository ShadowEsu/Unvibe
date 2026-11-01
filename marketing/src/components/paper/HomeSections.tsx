import demo from "@/data/demoMedia.json";
import { startupPrograms } from "@/data/compensation";
import { AppTour } from "@/components/paper/AppTour";
import { DemoDisclosure } from "@/components/paper/DemoDisclosure";
import { SHORTCUTS } from "@/lib/shortcuts";

/**
 * The real app screens the home page shows, each labelled with the version it was captured on (W19).
 * The 0.1.47 files are QA's real captures (capture/0147: panel Beginner, Test me 2 of 3, Today), as WebP;
 * Quiz has no 0.1.47 capture yet, so it keeps the earlier screenshot and says so.
 */
export const HOME_SCREENS = {
  panel: { src: "/unvibe/real/0147-panel-beginner.webp", width: 880, height: 1006, version: "0.1.47", alt: "The Unvibe panel explaining a debounce function at the Beginner depth" },
  testMe: { src: "/unvibe/real/0147-test-me.webp", width: 880, height: 1006, version: "0.1.47", alt: "Test me, question 2 of 3: what happens if you delete clearTimeout from the debounce function" },
  today: { src: "/unvibe/real/0147-today.webp", width: 1600, height: 994, version: "0.1.47", alt: "The Unvibe Today page with the day's goal ticked and an Up next list" },
  quiz: { src: "/unvibe/real/quiz.webp", width: 1600, height: 849, version: demo.version, alt: "The Unvibe Quick Quiz page listing a saved Debouncing lesson" },
} as const;

const CODE = ["function debounce(fn, wait) {", "  let timer;", "  return (...args) => {", "    clearTimeout(timer);", "    timer = setTimeout(() => fn(...args), wait);", "  };", "}"];

/** Section 2 of the home page (Design W2): three steps as one row, then the demo behind a button. */
export function HomeSteps() {
  const [macMod, macKey] = SHORTCUTS.mac.anywhere.split("+");
  return (
    <section className="paper-section" id="product" aria-labelledby="steps-title">
      <div className="paper-wrap u-sheet">
        <div className="sec-head">
          <p className="paper-meta">How it works</p>
          <h2 id="steps-title">Three steps, <em>in any app.</em></h2>
          <p className="paper-lead">Works wherever you can select code: Cursor, VS Code, Xcode, Terminal or your browser.</p>
        </div>
        <ol className="steps-row">
          <li className="steps-row__step">
            <span className="steps-row__num" aria-hidden="true">1</span>
            <h3>Select the code</h3>
            <p>A function, a query, a regex or the diff your agent just wrote.</p>
            <pre className="steps-row__code" aria-hidden="true">
              {CODE.map((line, index) => (
                <span key={line} className={index >= 2 && index <= 5 ? "is-selected" : undefined}>{line}{"\n"}</span>
              ))}
            </pre>
          </li>
          <li className="steps-row__step">
            <span className="steps-row__num" aria-hidden="true">2</span>
            <h3>Press {SHORTCUTS.mac.anywhere}</h3>
            <p>{SHORTCUTS.windows.anywhere} on Windows. The panel opens beside your editor.</p>
            <div className="steps-row__keys">
              <span><kbd>{macMod}</kbd> <kbd>{macKey}</kbd></span>
              <small>You can change the shortcut in Settings.</small>
            </div>
          </li>
          <li className="steps-row__step">
            <span className="steps-row__num" aria-hidden="true">3</span>
            <h3>Read it at your level</h3>
            <p>New, Beginner, Intermediate or Advanced. Ask a follow-up in the same panel.</p>
            <figure className="shot">
              {/* eslint-disable-next-line @next/next/no-img-element -- the site serves its own sized WebP files */}
              <img src={HOME_SCREENS.panel.src} alt={HOME_SCREENS.panel.alt} width={HOME_SCREENS.panel.width} height={HOME_SCREENS.panel.height} loading="lazy" decoding="async" />
              <figcaption>Unvibe {HOME_SCREENS.panel.version}</figcaption>
            </figure>
          </li>
        </ol>
        <DemoDisclosure>
          <AppTour />
        </DemoDisclosure>
      </div>
    </section>
  );
}

/** Section 3 (Design W2): the learning loop as three cards, no tabs. */
export function HomeLoop() {
  const cards = [
    { ...HOME_SCREENS.testMe, title: "Test me", body: "One question about the code you just read, right in the panel." },
    { ...HOME_SCREENS.today, title: "Today", body: "What you understood and what is due for review." },
    { ...HOME_SCREENS.quiz, title: "Quiz", body: "A short review built from the lessons in your Library." },
  ];
  return (
    <section className="paper-section" id="loop" aria-labelledby="loop-title">
      <div className="paper-wrap u-sheet">
        <div className="sec-head">
          <p className="paper-meta">Remember it</p>
          <h2 id="loop-title">Then check <em>it stuck.</em></h2>
          <p className="paper-lead">Every explanation ends with Test me, and the lessons you keep come back for review.</p>
        </div>
        <ul className="loop-cards">
          {cards.map((card) => (
            <li className="loop-cards__card" key={card.title}>
              <figure className="shot">
                {/* eslint-disable-next-line @next/next/no-img-element -- the site serves its own sized WebP files */}
                <img src={card.src} alt={card.alt} width={card.width} height={card.height} loading="lazy" decoding="async" />
                <figcaption>Unvibe {card.version}</figcaption>
              </figure>
              <h3>{card.title}</h3>
              <p>{card.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

const COUNT_WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];

/** The startup programs, as one line at the foot of the home page (Design W2). */
export function HomeBackingLine() {
  const others = startupPrograms.length - 1;
  return (
    <p className="home-backing">
      Unvibe is in {startupPrograms[0].program} and {COUNT_WORDS[others] ?? others} other startup programs.{" "}
      <a className="paper-text-link" href="/investors#backing">Details on the investors page</a>
    </p>
  );
}
