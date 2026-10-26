/**
 * The line under a finished "Try it" answer. `ms` is measured on the visitor's own request, from
 * sending it to the last of the answer arriving, so the number is true for that run. Null (show
 * nothing) when there is no usable measurement.
 */
export function answerTimeLine(ms: number): string | null {
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const seconds = Math.max(0.1, Math.round(ms / 100) / 10);
  return `That took ${seconds.toFixed(1)} seconds. Do it on your own code:`;
}
