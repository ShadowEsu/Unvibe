/**
 * Today page rules (Design UX upgrade C1): first-run teaching shows only while Today is empty, and
 * the week's numbers read as one sentence instead of four chips.
 */

/** Counts from the last 7 days, rolling (`computeWeek` in core/learning). No concept count: see there. */
export interface TodayCounts {
  explanations: number;
  linesExplained: number;
  linesUnderstood: number;
}

/**
 * Today is empty until the first explanation ever (the all-time profile, not this week's counts), so
 * a returning user after a quiet week doesn't get the first-run cards again. While the profile is
 * still loading (null) nothing is known, so the cards stay hidden rather than flash on a filled profile.
 */
export function todayFirstRun(profile: { reviews: number } | null): { explainBanner: boolean; voiceCard: boolean } {
  const empty = profile !== null && profile.reviews === 0;
  return { explainBanner: empty, voiceCard: empty };
}

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * "This week: 12 explanations, 52 lines explained, 20 lines understood." A zero count gets no clause,
 * except explanations, which say "no explanations yet".
 */
export function weekSentence(counts: TodayCounts): string {
  const parts = [
    counts.explanations > 0 ? count(counts.explanations, 'explanation', 'explanations') : 'no explanations yet',
    counts.linesExplained > 0 ? count(counts.linesExplained, 'line explained', 'lines explained') : '',
    counts.linesUnderstood > 0 ? count(counts.linesUnderstood, 'line understood', 'lines understood') : '',
  ].filter(Boolean);
  return `This week: ${parts.join(', ')}.`;
}

export interface RecentLesson { id: string; title: string; meta: string; ts: string }

/**
 * Recently understood shows each lesson once (Design P17): the same concept in the same file,
 * explained again at another depth or with Explain differently, keeps only its latest time.
 */
export function distinctLessons(items: readonly RecentLesson[], limit = 5): RecentLesson[] {
  const latest = new Map<string, RecentLesson>();
  for (const item of items) {
    const key = `${item.title.trim().toLowerCase()}\u0000${item.meta}`;
    const kept = latest.get(key);
    if (!kept || item.ts > kept.ts) latest.set(key, item);
  }
  return [...latest.values()].sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, limit);
}
