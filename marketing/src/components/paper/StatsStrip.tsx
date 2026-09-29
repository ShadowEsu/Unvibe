import { CountUp } from "@/components/paper/CountUp";
import { getDownloadStats } from "@/lib/downloadStats";

/** Social proof under the hero. Downloads are live GitHub installer counts. */
export async function StatsStrip() {
  const downloads = await getDownloadStats();
  const items: Array<{ value: number; suffix: string; label: string }> = [
    ...(downloads.source === "github" && downloads.total > 0
      ? [{ value: downloads.total, suffix: "+", label: "installer downloads" }]
      : []),
    { value: 800, suffix: "+", label: "followers across socials" },
    { value: 5, suffix: "×", label: "Startup of the Day" },
    { value: 5, suffix: "", label: "explanation depths" },
  ];

  return (
    <section className="stats-strip" aria-label="Unvibe by the numbers">
      <div className="paper-wrap stats-strip__row">
        {items.map((item) => (
          <div key={item.label} className="stats-strip__item">
            <strong><CountUp value={item.value} suffix={item.suffix} /></strong>
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
