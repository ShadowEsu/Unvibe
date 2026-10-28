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
    body: "An agent touched six files. A Change Brief lists what changed and what to read first.",
  },
] as const;

export function WhoItsForCards() {
  return (
    <div className="inv-cards">
      {AUDIENCES.map((audience) => (
        <article key={audience.title} className="inv-card">
          <h3>{audience.title}</h3>
          <p>{audience.body}</p>
        </article>
      ))}
    </div>
  );
}
