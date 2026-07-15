import Link from 'next/link';

export function SignInNotice() {
  return (
    <div className="empty">
      <p className="empty__title">Not connected yet</p>
      <p>
        <Link href="/login" style={{ textDecoration: 'underline', textUnderlineOffset: 2 }}>Sign in</Link> or{' '}
        <Link href="/signup" style={{ textDecoration: 'underline', textUnderlineOffset: 2 }}>create an account</Link> to sync your learning across devices.
      </p>
    </div>
  );
}
