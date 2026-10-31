import type { ReactNode } from 'react';
import { Buddy, type BuddyMood } from '../shared/buddy';

export interface PanelHeaderProps {
  mood: BuddyMood;
  /** What is being explained (lines, language, app), or nothing before a capture. */
  source: ReactNode;
  status: { label: string; tone: string };
  usage: { remaining: number; resetsAt: string } | null;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onClose: () => void;
}

/**
 * The panel header (Design A9): the status, the count, collapse and close, nothing else. The panel
 * look (paper or ink) lives at the foot of the tool rail, and Library is a rail tool.
 */
export function PanelHeader({ mood, source, status, usage, collapsed, onToggleCollapse, onClose }: PanelHeaderProps) {
  return (
    <div className="head">
      <span className="head__mark head__mark--vibe" aria-hidden="true">
        <Buddy mood={mood} size={26} label="Vibe" />
      </span>
      <div className="head__context">
        <span className="head__product">Unvibe</span>
        {source}
      </div>
      <span className={`head__status head__status--${status.tone}`} role="status"><i aria-hidden="true" />{status.label}</span>
      <div className="head__actions">
        {usage && (
          <span className="head__usage" title={`Resets ${new Date(usage.resetsAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}`}>
            {usage.remaining} left
          </span>
        )}
        <button type="button" className="head__glyph" aria-label={collapsed ? 'Expand panel' : 'Collapse panel'} aria-expanded={!collapsed} title={collapsed ? 'Expand' : 'Collapse'} onClick={onToggleCollapse}>
          <span aria-hidden="true">{collapsed ? '▾' : '▴'}</span>
        </button>
        <button type="button" className="head__glyph" aria-label="Close panel" title="Close" onClick={onClose}>
          <span aria-hidden="true">✕</span>
        </button>
      </div>
    </div>
  );
}
