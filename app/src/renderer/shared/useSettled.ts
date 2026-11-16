import { useEffect, useState } from 'react';

/** The arrival stagger's full length: --m-normal + 7 × --m-stagger (app-0151.css §3 row 3). */
const ARRIVAL_MS = 350 + 7 * 70;

/**
 * False while a screen's arrival stagger plays, true after it. Lists mark `data-m-settled` with it so the stagger
 * (Design r2-motion SPEC §3 row 3) plays once per visit and rows re-rendered later by a filter, sort or search
 * appear at once.
 */
export function useSettled() {
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(true), ARRIVAL_MS);
    return () => window.clearTimeout(timer);
  }, []);
  return settled;
}
