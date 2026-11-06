import { IC } from './icons';

export type PageId = 'Home' | 'Learn' | 'Study' | 'History' | 'Quiz' | 'Chat' | 'Progress' | 'Plan' | 'Gift' | 'Projects' | 'Concepts' | 'Notebook' | 'Briefings' | 'Library' | 'Profile';

export interface NavPage { id: PageId; icon: string }

export const NAV_PINNED: NavPage[] = [
  { id: 'Home', icon: IC.home },
  { id: 'Chat', icon: IC.chat },
];

export const NAV_SPACES: NavPage[] = [
  { id: 'Learn', icon: IC.study },
  { id: 'Quiz', icon: IC.quiz },
  { id: 'Briefings', icon: IC.briefings },
];

/** Under "More" in the sidebar (frozen `app.html`): open whenever one of these pages is showing. */
export const NAV_MORE: NavPage[] = [
  { id: 'Progress', icon: IC.progress },
  { id: 'Plan', icon: IC.plan },
  { id: 'Gift', icon: IC.gift },
];

export const NAV = [...NAV_PINNED, ...NAV_SPACES, ...NAV_MORE];
export const MORE_ICON = 'M5 10h.01 M10 10h.01 M15 10h.01';

/** The name a page goes by in the sidebar and the top bar. */
export function pageLabel(id: string): string {
  if (id === 'Home') return 'Today';
  if (id === 'Chat') return 'Ask Vibe';
  if (id === 'Learn') return 'Library';
  if (id === 'Quiz') return 'Quiz';
  if (id === 'Briefings') return 'Briefs';
  if (id === 'Progress') return 'Momentum';
  if (id === 'Gift') return 'Share';
  return id;
}
