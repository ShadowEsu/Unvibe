type NavigatorPerformanceHints = Navigator & {
  connection?: { saveData?: boolean };
  deviceMemory?: number;
};

/**
 * Keep the full editorial experience on capable machines while avoiding the
 * heaviest continuous motion on constrained or data-saving devices.
 */
export function prefersLiteExperience(): boolean {
  if (typeof window === "undefined") return false;
  const navigatorWithHints = window.navigator as NavigatorPerformanceHints;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const saveData = navigatorWithHints.connection?.saveData === true;
  const lowMemory = (navigatorWithHints.deviceMemory ?? Number.POSITIVE_INFINITY) <= 4;
  const lowCpu = (navigatorWithHints.hardwareConcurrency ?? Number.POSITIVE_INFINITY) <= 4;
  return reducedMotion || saveData || (lowMemory && lowCpu);
}
