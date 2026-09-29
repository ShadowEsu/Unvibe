import type { Metadata } from 'next';
import { Inter, Newsreader } from 'next/font/google';
import './activate.css';

const sans = Inter({ subsets: ['latin'], variable: '--a-font-sans', display: 'swap' });
const display = Newsreader({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  weight: ['400', '500'],
  variable: '--a-font-display',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Connect Unvibe',
  description: 'Approve your desktop app and finish signing in.',
  robots: { index: false, follow: false },
};

/** Full-viewport overlay so the dashboard chrome is not visible on this flow. */
export default function ActivateLayout({ children }: { children: React.ReactNode }) {
  return <div className={`activate-root ${sans.variable} ${display.variable}`}>{children}</div>;
}
