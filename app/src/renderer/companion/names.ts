/**
 * One name per thing in the companion (Design audit A5, polish bar B-11). The sidebar, the page
 * headings, search and copy all read from here, so a page is never called two things.
 */
export const PAGE_NAMES = {
  Home: 'Today',
  Chat: 'Ask Vibe',
  Learn: 'Library',
  Quiz: 'Quiz',
  Briefings: 'Briefs',
  Progress: 'Momentum',
  Plan: 'Plan',
  Gift: 'Share',
} as const;

/** The AI Unvibe hosts, as opposed to a provider key the person brings. */
export const HOSTED_AI = 'Unvibe AI';

/** The local git recap on Briefs, and the one action that sends its diff to the AI (Pro). */
export const CHANGE_BRIEF = 'Change Brief';
export const UNDERSTAND_CHANGE = 'Understand change';

/** Every "skip this for now" button in setup and in prompts. */
export const NOT_NOW = 'Not now';
