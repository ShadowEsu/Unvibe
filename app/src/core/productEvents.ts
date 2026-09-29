/** Desktop product events. Names only — never source, keys, or prompts. */
export type ProductEventName =
  | 'change_brief_opened'
  | 'explanation_completed'
  | 'followup_asked'
  | 'knowledge_saved'
  | 'teachback_completed'
  | 'knowledge_refreshed'
  | 'origin_opened'
  | 'voice_asked';

export function productEvent(_name: ProductEventName, _props?: Record<string, string | number | boolean>): void {
  /* Local product telemetry is not shipped to analytics from the desktop process. */
}
