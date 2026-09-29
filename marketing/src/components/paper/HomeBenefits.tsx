const BENEFITS = [
  {
    step: "01",
    title: "Get it in plain English",
    body: "Select any code and press ⌘U. A short explanation opens right beside your editor, at the depth you pick.",
  },
  {
    step: "02",
    title: "Make it stick",
    body: "Save the explanation, ask a follow-up, then take a one-question quiz so you remember it next week.",
  },
  {
    step: "03",
    title: "Keep secrets private",
    body: "Keys and tokens are caught on your computer before anything is sent. Your repo is never uploaded.",
  },
] as const;

/** Three plain benefits under the homepage demo video. */
export function HomeBenefits() {
  return (
    <div className="resources-grid resources-grid--3 home-benefits">
      {BENEFITS.map((item) => (
        <div key={item.step} className="resources-card paper-glass">
          <div className="resources-card__step">{item.step}</div>
          <h3>{item.title}</h3>
          <p>{item.body}</p>
        </div>
      ))}
    </div>
  );
}
