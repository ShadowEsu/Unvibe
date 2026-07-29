import Image from "next/image";

const stories = [
  {
    eyebrow: "01 · UNDERSTAND IN PLACE",
    title: "A focused explanation, beside your code.",
    description: "Unvibe captures the exact selection, explains it at your level, and keeps the rest of your workflow quiet.",
    image: "/product-shots/onboarding-dark.png",
    alt: "Unvibe onboarding screen in dark mode",
    notes: ["Selected code", "Five depth levels", "Follow-up questions"],
  },
  {
    eyebrow: "02 · KEEP THE CONTEXT",
    title: "Learning stays attached to the work.",
    description: "Re-open reviewed code, return to saved explanations, and see the concepts developing across your projects.",
    image: "/product-shots/quiz-lessons-dark.png",
    alt: "Unvibe quiz screen showing saved project lessons in dark mode",
    notes: ["Review history", "Saved lessons", "Project context"],
  },
  {
    eyebrow: "03 · PROVE YOU KNOW IT",
    title: "Turn explanations into real understanding.",
    description: "Quick checks and progress records show what you can explain—not simply how much code an agent generated.",
    image: "/product-shots/progress-dark.png",
    alt: "Unvibe progress screen showing lines understood and review activity",
    notes: ["Test me", "Concept recall", "Understanding over time"],
  },
] as const;

export function DarkProductShowcase() {
  return (
    <section className="product-stories" id="product" aria-labelledby="product-title">
      <div className="container-page">
        <header className="product-stories__header" data-home-reveal>
          <p>HOW UNVIBE WORKS</p>
          <h2 id="product-title">One quiet loop for understanding AI-written code.</h2>
        </header>
        <div className="product-stories__stack">
          {stories.map((story, index) => (
            <article className={index % 2 ? "product-story product-story--reverse" : "product-story"} key={story.title} data-home-reveal>
              <div className="product-story__copy">
                <p>{story.eyebrow}</p>
                <h3>{story.title}</h3>
                <span>{story.description}</span>
                <ul>
                  {story.notes.map((note) => <li key={note}>{note}</li>)}
                </ul>
              </div>
              <div className="product-story__visual">
                <Image
                  src={story.image}
                  alt={story.alt}
                  fill
                  sizes="(max-width: 850px) 100vw, 62vw"
                  className="object-cover object-top"
                />
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
