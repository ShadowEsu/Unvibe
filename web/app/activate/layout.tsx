import type { Metadata } from 'next';
import './activate.css';

export const metadata: Metadata = {
  title: 'Connect Unvibe',
  description: 'Approve your desktop app and finish signing in.',
};

/** Full-viewport overlay so the dashboard chrome is not visible on this flow. */
export default function ActivateLayout({ children }: { children: React.ReactNode }) {
  return <div className="activate-root">{children}</div>;
}
