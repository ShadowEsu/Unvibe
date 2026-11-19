import type { ReactNode } from 'react';

/**
 * Vibe's signed speech (SPEC §3): a small bubble that carries its name. Vibe says 8 words or fewer.
 * `large` is the onboarding size. A live bubble is announced when its words change.
 */
export function VibeBubble({ children, large = false, live = true, className = '' }: {
  children: ReactNode;
  large?: boolean;
  live?: boolean;
  className?: string;
}) {
  return (
    <p className={`vibe-bubble${large ? ' vibe-bubble--large' : ''} ${className}`.trim()} role={live ? 'status' : undefined}>
      <span className="vibe-bubble__name">Vibe</span>
      {children}
    </p>
  );
}
