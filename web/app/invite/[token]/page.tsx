import { createHash } from 'node:crypto';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { newTiersEnabled } from '@/billing/plans';
import { getBillingStore } from '@/billing/store';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Join your team on Unvibe',
  robots: { index: false, follow: false },
};

/** /beta detects Mac or Windows itself, so one link serves both. */
const DOWNLOAD_URL = 'https://unvibe.site/beta';

/**
 * An invitation link. The desktop app is the only sign-in, and the seat attaches when the invited
 * address signs in there (POST /api/v1/auth/approve runs acceptPendingInvitations), so this page only
 * says how. Off (404) until Teams and Big Business go on sale: BILLING_NEW_TIERS_ENABLED.
 */
export default async function InvitePage({ params }: { params: { token: string } }) {
  if (!newTiersEnabled()) notFound();
  const tokenHash = createHash('sha256').update(params.token).digest('hex');
  const invite = params.token.length >= 20 ? await getBillingStore().invitationPreview(tokenHash).catch(() => null) : null;

  if (!invite || !invite.open) {
    return (
      <section className="auth-page" aria-labelledby="invite-title">
        <p className="eyebrow">Workspace invitation</p>
        <h1 id="invite-title">This invitation can&apos;t be used</h1>
        <p>It may have expired, been used already, or been withdrawn. Ask the person who invited you to send a new one.</p>
      </section>
    );
  }

  return (
    <section className="auth-page" aria-labelledby="invite-title">
      <p className="eyebrow">Workspace invitation</p>
      <h1 id="invite-title">Join {invite.workspaceName} on Unvibe</h1>
      <ol className="invite-steps">
        <li>
          <b>Download Unvibe</b> for Mac or Windows.
          <a className="btn btn--primary" href={DOWNLOAD_URL}>Download Unvibe</a>
        </li>
        <li><b>Open it and sign in</b> with <b>{invite.email}</b>, the address this invitation was sent to.</li>
        <li><b>Your seat attaches when you sign in.</b> There is nothing else to accept.</li>
      </ol>
    </section>
  );
}
