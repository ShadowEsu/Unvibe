/** A 20×20 line icon drawn from one of the `IC` paths; stroke and size come from CSS. */
export function LineIcon({ d, className }: { d: string; className?: string }) {
  return <svg className={className} viewBox="0 0 20 20" aria-hidden="true" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;
}
