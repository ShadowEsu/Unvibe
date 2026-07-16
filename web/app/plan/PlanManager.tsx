'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { BillingInterval, WorkspaceAccess, WorkspaceInvitation, WorkspaceMember } from '@/billing/types';
import type { PublicBillingOverview as BillingOverview } from '@/billing/presentation';

interface Props { initialOverview: BillingOverview; initialWorkspaces: WorkspaceAccess[]; checkoutAvailable: boolean }

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) } });
  const data = await response.json().catch(() => ({})) as { message?: string };
  if (!response.ok) throw new Error(data.message ?? 'Request failed.');
  return data as T;
}

export function PlanManager({ initialOverview, initialWorkspaces, checkoutAvailable }: Props) {
  const [overview, setOverview] = useState(initialOverview);
  const [workspaces, setWorkspaces] = useState(initialWorkspaces);
  const [interval, setInterval] = useState<BillingInterval>('monthly');
  const [teamSeats, setTeamSeats] = useState(Math.max(2, initialOverview.subscription.seats));
  const [teamName, setTeamName] = useState('My team');
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [invitations, setInvitations] = useState<WorkspaceInvitation[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member');
  const [lastInviteUrl, setLastInviteUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const initialTrackingRef = useRef(false);
  const checkoutRefreshRef = useRef(false);

  const loadWorkspace = useCallback(async (workspaceId: string) => {
    setBusy(true); setNotice('');
    try {
      const data = await requestJson<{ overview: BillingOverview; workspaces: WorkspaceAccess[] }>(`/api/v1/billing/overview?workspaceId=${encodeURIComponent(workspaceId)}`);
      setOverview(data.overview); setWorkspaces(data.workspaces); setTeamSeats(data.overview.subscription.seats);
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Could not load workspace.'); }
    finally { setBusy(false); }
  }, []);

  const loadTeam = useCallback(async () => {
    if (overview.workspace.type !== 'team' || !overview.canManageMembers) { setMembers([]); setInvitations([]); return; }
    try {
      const [memberData, inviteData] = await Promise.all([
        requestJson<{ members: WorkspaceMember[] }>(`/api/v1/workspaces/${overview.workspace.id}/members`),
        requestJson<{ invitations: WorkspaceInvitation[] }>(`/api/v1/workspaces/${overview.workspace.id}/invitations`),
      ]);
      setMembers(memberData.members); setInvitations(inviteData.invitations);
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Could not load team details.'); }
  }, [overview.workspace.id, overview.workspace.type, overview.canManageMembers]);

  useEffect(() => { void loadTeam(); }, [loadTeam]);

  useEffect(() => {
    if (initialTrackingRef.current) return;
    initialTrackingRef.current = true;
    const params = new URLSearchParams(window.location.search);
    const event = params.get('checkout') === 'canceled' ? 'checkout.canceled' : 'plan.comparison_viewed';
    void fetch('/api/v1/billing/event', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ event, workspaceId: initialOverview.workspace.id }) });
    if (event === 'checkout.canceled') { setNotice('Checkout was canceled. Nothing was charged or changed.'); window.history.replaceState({}, '', '/plan'); }
  }, [initialOverview.workspace.id]);

  useEffect(() => {
    if (checkoutRefreshRef.current) return;
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    if (params.get('checkout') !== 'success' || !sessionId) return;
    checkoutRefreshRef.current = true;
    setBusy(true); setNotice('Confirming your subscription with Stripe…');
    void requestJson<{ overview?: BillingOverview; pending?: boolean }>('/api/v1/billing/refresh', { method: 'POST', body: JSON.stringify({ sessionId }) })
      .then((data) => { if (data.overview) { setOverview(data.overview); setNotice('Your plan is active.'); } else setNotice('Payment is still processing. Your plan will update automatically.'); })
      .catch((error: unknown) => setNotice(error instanceof Error ? error.message : 'Plan refresh is still pending.'))
      .finally(() => { setBusy(false); window.history.replaceState({}, '', '/plan'); });
  }, []);

  const checkout = async (plan: 'pro' | 'teams') => {
    setBusy(true); setNotice('');
    try {
      void fetch('/api/v1/billing/event', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ event: 'upgrade_prompt.clicked', workspaceId: overview.workspace.id, plan, interval }) });
      const body = plan === 'pro'
        ? { plan, interval, seats: 1 }
        : { plan, interval, seats: teamSeats, ...(overview.workspace.type === 'team' ? { workspaceId: overview.workspace.id } : { workspaceName: teamName }) };
      const data = await requestJson<{ url: string }>('/api/v1/billing/checkout', { method: 'POST', body: JSON.stringify(body) });
      window.location.assign(data.url);
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Checkout could not start.'); setBusy(false); }
  };

  const manageBilling = async () => {
    setBusy(true); setNotice('');
    try {
      const data = await requestJson<{ url: string }>('/api/v1/billing/portal', { method: 'POST', body: JSON.stringify({ workspaceId: overview.workspace.id }) });
      window.location.assign(data.url);
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Billing portal could not open.'); setBusy(false); }
  };

  const updateSeats = async () => {
    setBusy(true); setNotice('');
    try {
      const data = await requestJson<{ overview: BillingOverview }>('/api/v1/billing/seats', { method: 'PATCH', body: JSON.stringify({ workspaceId: overview.workspace.id, seats: teamSeats }) });
      setOverview(data.overview); setNotice('Seat quantity updated. Stripe will apply any prorated adjustment.');
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Seats could not be updated.'); }
    finally { setBusy(false); }
  };

  const invite = async () => {
    setBusy(true); setNotice(''); setLastInviteUrl('');
    try {
      const data = await requestJson<{ invitation: WorkspaceInvitation; inviteUrl: string }>(`/api/v1/workspaces/${overview.workspace.id}/invitations`, { method: 'POST', body: JSON.stringify({ email: inviteEmail, role: inviteRole }) });
      setInvitations((current) => [data.invitation, ...current]); setLastInviteUrl(data.inviteUrl); setInviteEmail('');
      setNotice('Invitation created. Share the secure link with the invited person.');
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Invitation could not be created.'); }
    finally { setBusy(false); }
  };

  const revokeInvite = async (invitationId: string) => {
    setBusy(true); setNotice('');
    try {
      await requestJson(`/api/v1/workspaces/${overview.workspace.id}/invitations/${invitationId}`, { method: 'DELETE' });
      setInvitations((current) => current.map((item) => item.id === invitationId ? { ...item, status: 'revoked' } : item));
      await loadWorkspace(overview.workspace.id);
      setNotice('Invitation revoked and its reserved seat released.');
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Invitation could not be revoked.'); }
    finally { setBusy(false); }
  };

  const updateRole = async (memberUserId: string, role: 'admin' | 'member') => {
    setBusy(true);
    try { await requestJson(`/api/v1/workspaces/${overview.workspace.id}/members/${memberUserId}`, { method: 'PATCH', body: JSON.stringify({ role }) }); await loadTeam(); }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Role could not be changed.'); }
    finally { setBusy(false); }
  };

  const removeMember = async (memberUserId: string) => {
    setBusy(true);
    try { await requestJson(`/api/v1/workspaces/${overview.workspace.id}/members/${memberUserId}`, { method: 'DELETE' }); await loadTeam(); await loadWorkspace(overview.workspace.id); }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Member could not be removed.'); }
    finally { setBusy(false); }
  };

  const priceLabel = useMemo(() => ({
    pro: interval === 'monthly' ? '$8/month' : '$96/year',
    teams: interval === 'monthly' ? '$8/member/month' : '$72/member/year',
  }), [interval]);

  return (
    <div className="plan-page">
      <header className="plan-header">
        <div><p className="eyebrow">Plan & usage</p><h1>Understand more. Pay only when you need more room.</h1></div>
        <label className="workspace-picker">Workspace<select value={overview.workspace.id} onChange={(event) => void loadWorkspace(event.target.value)} disabled={busy}>{workspaces.map((workspace) => <option value={workspace.id} key={workspace.id}>{workspace.name} · {workspace.type}</option>)}</select></label>
      </header>

      {notice && <p className="plan-notice" role="status">{notice}</p>}
      {!checkoutAvailable && <p className="plan-notice plan-notice--quiet">Checkout is safely disabled until the server has Stripe test-mode keys, four trusted price IDs, and a webhook secret.</p>}

      <section className="current-plan">
        <div><span>Current plan</span><strong>{overview.subscription.plan === 'teams' ? 'Teams' : overview.subscription.plan === 'pro' ? 'Pro' : 'Free'}</strong></div>
        <div><span>Billing interval</span><strong>{overview.subscription.interval ?? 'No billing'}</strong></div>
        <div><span>Status</span><strong>{overview.subscription.plan === 'free' ? 'Ready' : overview.subscription.status.replaceAll('_', ' ')}</strong></div>
        <div><span>{overview.subscription.cancelAtPeriodEnd ? 'Access through' : 'Renews'}</span><strong>{overview.subscription.currentPeriodEnd ? new Date(overview.subscription.currentPeriodEnd).toLocaleDateString() : 'Not applicable'}</strong></div>
        <div><span>Workspace role</span><strong>{overview.workspace.role}</strong></div>
        {overview.canManageBilling && overview.hasBillingAccount && <button className="btn btn--secondary" onClick={() => void manageBilling()} disabled={busy}>Manage billing</button>}
      </section>

      <section className="usage-panel" aria-labelledby="usage-title">
        <h2 id="usage-title">This month</h2>
        <div className="usage-grid">{overview.usage.map((line) => <div className="usage-item" key={line.kind}><div><span>{line.kind.replaceAll('_', ' ')}</span><strong>{line.used} / {line.limit}</strong></div><progress value={line.used} max={line.limit} /><small>Resets {new Date(line.resetsAt).toLocaleDateString()}</small></div>)}</div>
      </section>

      <section className="pricing-controls" aria-label="Billing interval"><button className={interval === 'monthly' ? 'active' : ''} onClick={() => setInterval('monthly')}>Monthly</button><button className={interval === 'annual' ? 'active' : ''} onClick={() => setInterval('annual')}>Annual</button></section>
      <section className="plan-grid">
        <article className="plan-card"><p>Free</p><h2>$0</h2><small>No card required</small><ul><li>30 AI explanations/month</li><li>1 active project</li><li>25 dictionary items</li><li>20 saved items</li></ul><button className="btn btn--secondary" disabled>Included</button></article>
        <article className="plan-card plan-card--featured"><p>Pro</p><h2>{priceLabel.pro}</h2><small>One personal account · annual is the same effective price</small><ul><li>1,000 AI explanations/month</li><li>Up to 10 active projects</li><li>Expanded learning library</li><li>Local secret filtering before remote requests</li></ul><button className="btn btn--primary" onClick={() => void checkout('pro')} disabled={busy || !checkoutAvailable || overview.workspace.type !== 'personal'}>Choose Pro</button></article>
        <article className="plan-card"><p>Teams</p><h2>{priceLabel.teams}</h2><small>{interval === 'annual' ? 'Save 25% · billed annually' : '2-seat minimum · $16/month minimum'}</small><ul><li>Shared team workspace</li><li>Owner, admin, and member roles</li><li>Usage scales with paid seats</li><li>Pending invites reserve seats</li></ul><div className="team-checkout"><input aria-label="Team name" value={teamName} onChange={(event) => setTeamName(event.target.value)} disabled={overview.workspace.type === 'team'} /><label>Seats<input type="number" min={2} max={500} value={teamSeats} onChange={(event) => setTeamSeats(Number(event.target.value))} /></label></div><p className="team-total">{interval === 'monthly' ? `${money.format(8 * teamSeats)}/month` : `${money.format(72 * teamSeats)}/year`} total</p><button className="btn btn--primary" onClick={() => void checkout('teams')} disabled={busy || !checkoutAvailable}>Choose Teams</button></article>
      </section>

      {overview.workspace.type === 'team' && <section className="team-panel">
        <h2>Team workspace</h2>
        <p>{overview.occupiedSeats} occupied · {overview.pendingInvitations} pending · {Math.max(0, overview.subscription.seats - overview.occupiedSeats - overview.pendingInvitations)} available · {overview.subscription.seats} paid seats</p>
        {overview.canManageBilling && overview.subscription.plan === 'teams' && <div className="seat-editor"><label>Paid seats<input type="number" min={overview.minimumBillableSeats} max={500} value={teamSeats} onChange={(event) => setTeamSeats(Number(event.target.value))} /></label><div><small>Estimated recurring total</small><strong>{overview.subscription.interval === 'annual' ? `${money.format(72 * teamSeats)}/year` : `${money.format(8 * teamSeats)}/month`}</strong></div><button className="btn btn--secondary" onClick={() => void updateSeats()} disabled={busy}>Update seats</button></div>}
        {overview.canManageMembers && <><h3>Members</h3><div className="member-list">{members.map((member) => <div className="member-row" key={member.userId}><span>{member.email ?? member.userId}</span><strong>{member.role}</strong>{overview.workspace.role === 'owner' && member.role !== 'owner' && <><select value={member.role} onChange={(event) => void updateRole(member.userId, event.target.value as 'admin' | 'member')}><option value="member">Member</option><option value="admin">Admin</option></select><button onClick={() => void removeMember(member.userId)}>Remove</button></>}</div>)}</div>
        <h3>Invite someone</h3><p className="plan-help">Accepted members and unexpired invitations reserve paid seats. Revoking or expiry releases the reservation.</p><div className="invite-form"><input type="email" placeholder="coder@example.com" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} /><select value={inviteRole} onChange={(event) => setInviteRole(event.target.value as 'admin' | 'member')}><option value="member">Member</option><option value="admin">Admin</option></select><button className="btn btn--primary" onClick={() => void invite()} disabled={busy || !inviteEmail}>Create invite</button></div>{lastInviteUrl && <div className="invite-link"><input readOnly value={lastInviteUrl} /><button onClick={() => void navigator.clipboard.writeText(lastInviteUrl)}>Copy</button></div>}<div className="invitation-list">{invitations.filter((inviteItem) => inviteItem.status === 'pending').map((inviteItem) => <p key={inviteItem.id}>{inviteItem.email} · {inviteItem.role} · expires {new Date(inviteItem.expiresAt).toLocaleDateString()} <button onClick={() => void revokeInvite(inviteItem.id)}>Revoke</button></p>)}</div></>}
      </section>}
    </div>
  );
}
