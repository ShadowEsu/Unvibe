/**
 * The panel's icons: Lucide (ISC licence, shared/licences/LUCIDE-ISC.txt), only the paths overlay B uses, inlined so
 * nothing loads at run time. Explain is Lucide's `code` (no sparkle motif: Security); JetBrains Mono has no ✓, so
 * every check is the `check` icon.
 */
const PATHS = {
  code: ['M16 18l6-6-6-6', 'M8 6l-6 6 6 6'],
  'circle-help': ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3', 'M12 17h.01'],
  'message-square': ['M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'],
  bookmark: ['m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z'],
  check: ['M20 6 9 17l-5-5'],
  x: ['M18 6 6 18', 'm6 6 12 12'],
  'arrow-up': ['m5 12 7-7 7 7', 'M12 19V5'],
  lock: ['M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2z', 'M7 11V7a5 5 0 0 1 10 0v4'],
  'chevron-right': ['m9 18 6-6-6-6'],
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 16, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg className={className ? `ob-icon ${className}` : 'ob-icon'} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {PATHS[name].map((d) => <path key={d} d={d} />)}
    </svg>
  );
}
