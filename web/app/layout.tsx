import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'Uncode',
  description: 'Understand, verify, and retain AI-generated code.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
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
        </nav>
        <main className="shell">{children}</main>
      </body>
    </html>
  );
}
