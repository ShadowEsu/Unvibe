import type { Metadata } from 'next';
import Link from 'next/link';
import { currentUserId } from '@/lib/session';
import './globals.css';

export const metadata: Metadata = {
  title: 'Uncode',
  description: 'Understand, verify, and retain AI-generated code.',
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

  return (
    <html lang="en">
      <body>
        <nav className="nav">
          <Link href="/" className="nav__brand">
            Uncode
          </Link>
          <Link href="/">Home</Link>
          <Link href="/history">History</Link>
          <Link href="/projects">Projects</Link>
          <Link href="/profile">Profile</Link>
          <span className="nav__spacer" />
          {userId ? (
            <SignOutBtn />
          ) : (
            <>
              <Link href="/login">Sign in</Link>
              <Link href="/signup" className="nav__signup">Sign up</Link>
            </>
          )}
        </nav>
        <main className="shell">{children}</main>
      </body>
    </html>
  );
}
