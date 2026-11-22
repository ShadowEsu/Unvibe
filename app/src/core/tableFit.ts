/**
 * How wide a finished answer's table is against the overlay's pane (Design, 0.1.55: wrap first; the stacked layout
 * is built only if real answers still overflow). Numbers only: no cell text ever reaches the log.
 */
export interface TableFit {
  columns: number;
  scrollWidth: number;
  clientWidth: number;
}

const whole = (value: unknown, max: number): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= max;

function isTableFit(value: unknown): value is TableFit {
  if (typeof value !== 'object' || value === null) return false;
  const fit: Partial<Record<keyof TableFit, unknown>> = value;
  return whole(fit.columns, 64) && whole(fit.scrollWidth, 100_000) && whole(fit.clientWidth, 100_000);
}

/** The main-process log line for a renderer's report, or null when the report isn't a plain set of sizes. */
export function tableFitLine(value: unknown): string | null {
  if (!isTableFit(value)) return null;
  const over = value.scrollWidth - value.clientWidth;
  const verdict = over > 1 ? `overflows by ${over} px` : 'fits';
  return `[table] ${value.columns} columns: ${value.scrollWidth} of ${value.clientWidth} px (${verdict})`;
}
