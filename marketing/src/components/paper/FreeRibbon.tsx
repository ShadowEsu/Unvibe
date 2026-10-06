/** A slow ribbon of the one thing everyone should know: it's free. */
const WORDS = ["Free", "No credit card", "Free", "No API key", "Free", "Mac and Windows", "Free", "30 explanations on us", "Free", "Your code stays yours"];

export function FreeRibbon() {
  const row = [...WORDS, ...WORDS];
  return (
    <div className="vribbon" aria-label="Unvibe is free. No credit card. No API key.">
      <div className="vribbon__track" aria-hidden="true">
        {row.map((word, index) => (
          <span key={index} className={word === "Free" ? "vribbon__free" : undefined}>{word}<i>✦</i></span>
        ))}
      </div>
    </div>
  );
}
