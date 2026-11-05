/** The three audiences, shared by the homepage band and /about so the copy lives in one place. */
const AUDIENCES = [
  {
    title: "You build with AI.",
    body: "Cursor, Claude Code, Copilot or a chatbot writes the code; you want to know what it does before you ship it.",
  },
  {
    title: "You're learning to code.",
    body: "AI answers feel too technical. Pick New or Beginner and read your own project at your level.",
  },
  {
    title: "You review AI changes.",
    body: "An agent touched 6 files. On Pro, a Change Brief lists what changed and what to read first.",
  },
] as const;

/** One glass panel, three columns split by hairlines (three rows on a phone): not three boxes (Design, ledger 443). */
export function WhoItsForCards() {
  return (
    <div className="who-panel">
      {AUDIENCES.map((audience) => (
        <article key={audience.title} className="who-panel__item">
          <h3>{audience.title}</h3>
          <p>{audience.body}</p>
        </article>
      ))}
    </div>
  );
}
