import { IC } from './icons';

export type PageId = 'Home' | 'Learn' | 'Study' | 'History' | 'Quiz' | 'Chat' | 'Progress' | 'Plan' | 'Gift' | 'Projects' | 'Concepts' | 'Notebook' | 'Briefings' | 'Library' | 'Profile';

export interface NavPage { id: PageId; icon: string }

export const NAV_PINNED: NavPage[] = [
  { id: 'Home', icon: IC.home },
  { id: 'Chat', icon: IC.chat },
];

/** Under "Learn" in the rail (Mono's A Rail: Library, Quiz, Briefs, Momentum). */
export const NAV_SPACES: NavPage[] = [
  { id: 'Learn', icon: IC.study },
  { id: 'Quiz', icon: IC.quiz },
  { id: 'Briefings', icon: IC.briefings },
  { id: 'Progress', icon: IC.progress },
];

/** Plan and Share left the Learn group: the rail's plan card opens Plan, and Share sits with Settings at the foot. */
export const NAV_FOOT: NavPage[] = [
  { id: 'Gift', icon: IC.gift },
  { id: 'Plan', icon: IC.plan },
];

export const NAV = [...NAV_PINNED, ...NAV_SPACES, ...NAV_FOOT];

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
