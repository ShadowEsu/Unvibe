import type { FaqItem } from "@/data/faq";

export function TypingFaq({ items }: { items: readonly FaqItem[] }) {
  return (
    <div className="paper-faq">
      {items.map((item) => (
          <details key={item.id}>
            <summary>{item.question}</summary>
            <p>{item.answer}</p>
          </details>
      ))}
    </div>
  );
}
