import type { Metadata } from 'next';
import { currentUserId } from '@/lib/session';
import './globals.css';

export const metadata: Metadata = {
  title: 'Unvibe',
  description: 'Your Unvibe plan, usage and workspace invitations.',
};

async function SignOutBtn() {
  return (
    <form action="/api/v1/auth/signout" method="post" style={{ display: 'inline' }}>
      <button type="submit" className="nav-btn">Sign out</button>
    </form>
  );
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const userId = await currentUserId();

  // Plain links, not next/link: the retired dashboard routes redirect to unvibe.site, and a prefetch of
  // a cross-origin redirect fails in the console (CORS). Only the site and /plan are linked.
  return (
    <html lang="en">
      <body>
        <nav className="nav">
          <a href="https://unvibe.site" className="nav__brand">
            Unvibe
          </a>
          <a href="/plan">Plan</a>
          <span className="nav__spacer" />
          {userId ? <SignOutBtn /> : null}
        </nav>
        <main className="shell">{children}</main>
      </body>
    </html>
  );
}
