import { InviteAccept } from './InviteAccept';

export default function InvitePage({ params }: { params: { token: string } }) {
  return <InviteAccept token={params.token} />;
}
