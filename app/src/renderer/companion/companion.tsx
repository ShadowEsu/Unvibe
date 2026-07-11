import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { LogoMark } from '../shared/logo';

type PageId =
  | 'Home'
  | 'Progress'
  | 'Projects'
  | 'Study'
  | 'Concepts'
  | 'Notebook'
  | 'Briefings'
  | 'Library'
  | 'Profile';

interface Feature { icon: string; t: string; d: string }
interface PageDef { id: PageId; icon: string; lead: string; features: Feature[] }

interface Profile {
  reviews: number;
  understood: number;
  needsReview: number;
  linesUnderstood: number;
  linesReviewed: number;
  conceptsSeen: number;
  conceptsMastered: number;
  streak: number;
  bestStreak: number;
  usage: Array<{ label: string; pct: number }>;
  heat: number[];
}
interface FeedItem { id: string; ts: string; title: string; meta: string; outcome: string }
type Account = { userId: string; email: string } | null;

const IC = {
  home: 'M3 9.5 10 3l7 6.5V17H3z M8 17v-5h4v5',
  progress: 'M4 16V9 M10 16V4 M16 16v-6',
  projects: 'M3 6a1 1 0 0 1 1-1h4l2 2h6a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z',
  study: 'M4 4h9a3 3 0 0 1 3 3v9a3 3 0 0 0-3-3H4z M4 4v9',
  concepts: 'M10 3l2.1 4.9L17 10l-4.9 2.1L10 17l-2.1-4.9L3 10l4.9-2.1z',
  notebook: 'M5 3h9a1 1 0 0 1 1 1v13l-3-2-3 2-3-2V4a1 1 0 0 1 1-1z M8 7h5 M8 10h5',
  briefings: 'M5 3h10v14H5z M8 7h4 M8 10h4 M8 13h2',
  library: 'M4 3h3v14H4z M9 3h3v14H9z M14 4l3 .8-3.4 12.6-2.9-.8z',
  profile: 'M10 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M4 17c.7-3 3-4.5 6-4.5s5.3 1.5 6 4.5',
  spark: 'M10 3v14 M3 10h14 M6 6l8 8 M14 6l-8 8',
  eye: 'M2 10s3-5 8-5 8 5 8 5-3 5-8 5-8-5-8-5z M10 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  layers: 'M10 3l7 4-7 4-7-4z M3 11l7 4 7-4',
  check: 'M4 10l4 4 8-9',
  clock: 'M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16z M10 6v4l3 2',
  map: 'M3 5l5-2 4 2 5-2v12l-5 2-4-2-5 2z M8 3v12 M12 5v12',
};

const PAGES: Record<Exclude<PageId, 'Home' | 'Progress'>, PageDef> = {
  Projects: { id: 'Projects', icon: IC.projects, lead: 'Every repository you point Unvibe at, distilled into something you can actually hold in your head.', features: [
    { icon: IC.eye, t: 'Plain-English summaries', d: 'What each repo is for and how it earns its keep — no folder-tree dumps.' },
    { icon: IC.layers, t: 'How it fits together', d: 'The moving parts and where they connect, so a new codebase stops feeling like a maze.' },
    { icon: IC.check, t: 'How much you grasp', d: 'A running sense of which corners you understand and which you have not opened yet.' },
    { icon: IC.map, t: 'Where to start reading', d: 'Unvibe points you at the file a newcomer should open first.' },
  ] },
  Study: { id: 'Study', icon: IC.study, lead: 'Guided tracks built from your own repositories — Unvibe teaches the parts that matter, one short lesson at a time.', features: [
    { icon: IC.map, t: 'Paths from your code', d: 'Frontend, backend, security, architecture, databases, testing — drawn from what you actually ship.' },
    { icon: IC.check, t: 'One lesson at a time', d: 'Bite-sized steps you can finish between commits, not a 40-hour course.' },
    { icon: IC.spark, t: 'Tuned to your level', d: 'Lessons meet you where you are and climb only as fast as you do.' },
    { icon: IC.clock, t: 'Pick up where you left off', d: 'Every track remembers your place, so momentum survives a busy week.' },
  ] },
  Concepts: { id: 'Concepts', icon: IC.concepts, lead: 'Your growing handbook of ideas — each one explained once, well, and tied back to the code where you met it.', features: [
    { icon: IC.eye, t: 'A definition that sticks', d: 'Plain wording first, precise wording second — never the other way around.' },
    { icon: IC.layers, t: 'Examples from your repos', d: 'Real snippets where the idea shows up in code you have touched.' },
    { icon: IC.spark, t: 'Gotchas and near-misses', d: 'The mistakes people make with each idea, so you spot them early.' },
    { icon: IC.check, t: 'A quick check', d: 'One question to prove it landed and mark the concept mastered.' },
  ] },
  Notebook: { id: 'Notebook', icon: IC.notebook, lead: 'The keeper for anything worth a second look — explanations, diagrams, and the back-and-forth you had with Unvibe.', features: [
    { icon: IC.notebook, t: 'Saved explanations', d: 'Star an explanation in any widget and it lands here, searchable.' },
    { icon: IC.layers, t: 'Diagrams', d: 'Execution flows and structure sketches, kept next to the code they describe.' },
    { icon: IC.spark, t: 'Threads', d: 'Whole follow-up conversations, not just the first answer.' },
    { icon: IC.clock, t: 'Nothing evaporates', d: 'Close a widget without worry — what you kept is still here tomorrow.' },
  ] },
  Briefings: { id: 'Briefings', icon: IC.briefings, lead: 'Short recaps of what changed and what you picked up — a two-minute read each morning, a longer one each week.', features: [
    { icon: IC.clock, t: 'Morning recap', d: 'What the agents changed overnight, told as a story rather than a diff.' },
    { icon: IC.check, t: 'Weekly review', d: 'The concepts you locked in and the ones worth revisiting.' },
    { icon: IC.eye, t: 'Written for skimming', d: 'Headline first, detail underneath — read as deep as you have time for.' },
    { icon: IC.spark, t: 'Only what moved', d: 'Quiet days stay quiet. Briefings appear when there is something to say.' },
  ] },
  Library: { id: 'Library', icon: IC.library, lead: 'Hand-picked reading matched to whatever you are learning right now — guides and roadmaps, minus the rabbit holes.', features: [
    { icon: IC.map, t: 'Roadmaps', d: 'The shape of a topic end to end, so you know what is left to learn.' },
    { icon: IC.eye, t: 'Focused guides', d: 'Chosen to match your open concepts — no endless tab-hoarding.' },
    { icon: IC.layers, t: 'Reference you keep', d: 'The pages you return to, gathered in one calm place.' },
    { icon: IC.check, t: 'Tied to your work', d: 'Every pick connects back to code you are actually reviewing.' },
  ] },
  Profile: { id: 'Profile', icon: IC.profile, lead: 'The long view of your learning — milestones you have hit, ideas you have mastered, and everything you have reviewed.', features: [
    { icon: IC.spark, t: 'Milestones', d: 'Quiet, earned markers — first repo understood, first week-long streak.' },
    { icon: IC.check, t: 'Mastery map', d: 'Concepts sorted by how solid they are, from seen to second-nature.' },
    { icon: IC.clock, t: 'Review history', d: 'A full trail of what you looked at and when.' },
    { icon: IC.layers, t: 'Yours to share', d: 'Turn a mastered track into a clean certificate when you want to.' },
  ] },
};

const NAV: Array<{ id: PageId; icon: string }> = [
  { id: 'Home', icon: IC.home },
  { id: 'Progress', icon: IC.progress },
  { id: 'Projects', icon: IC.projects },
  { id: 'Study', icon: IC.study },
  { id: 'Concepts', icon: IC.concepts },
  { id: 'Notebook', icon: IC.notebook },
  { id: 'Briefings', icon: IC.briefings },
  { id: 'Library', icon: IC.library },
  { id: 'Profile', icon: IC.profile },
];

const FOOT: Array<{ id: string; icon: string; toast: string }> = [
  { id: 'Bring your team', icon: 'M8 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M2.5 17c.6-2.8 2.7-4.2 5.5-4.2 M14 7v6 M11 10h6', toast: 'Team spaces are on the way.' },
  { id: 'Refer a friend', icon: 'M3 8h14v9H3z M3 8l2-4h10l2 4 M10 8v9', toast: 'Referrals open once Unvibe leaves beta.' },
  { id: 'Settings', icon: 'M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z M10 2.8l1 2.2 2.4-.6 1.2 2-1.7 1.8.8 2.3-2.2 1-.1 2.5H9.6l-.1-2.5-2.2-1 .8-2.3-1.7-1.8 1.2-2 2.4.6z', toast: '' },
  { id: 'Help', icon: 'M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16z M7.8 7.5A2.3 2.3 0 0 1 12.2 8c0 1.5-2.2 1.7-2.2 3 M10 14h.01', toast: 'Docs are being written.' },
];

function Icon({ d }: { d: string }) {
  return <svg viewBox="0 0 20 20" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function SignInForm({ onDone }: { onDone: (email: string) => void }) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const submit = async () => {
    setBusy(true);
    setErr('');
    const r = (await window.unvibe.signIn(email)) as { ok: boolean; email?: string; error?: string };
    setBusy(false);
    if (r.ok && r.email) onDone(r.email);
    else setErr(r.error ?? 'Sign-in failed.');
  };
  return (
    <div className="signin">
      <input
        className="field"
        type="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && email && submit()}
      />
      <button className="field-btn" disabled={busy || !email} onClick={submit}>
        {busy ? 'Signing in…' : 'Continue'}
      </button>
      {err && <div className="field-err">{err}</div>}
      <div className="field-note">Passwordless while in beta — we email you a link later. No password to forget.</div>
    </div>
  );
}

function LoginScreen({ onSignedIn, onSkip }: { onSignedIn: (email: string) => void; onSkip: () => void }) {
  return (
    <div className="login">
      <div className="login__card">
        <div className="login__mark"><LogoMark size={54} stroke={1.7} /></div>
        <div className="login__brand">unvibe</div>
        <h2 className="login__tag">Understand everything you ship.</h2>
        <p className="login__sub">Sign in to sync your learning across devices — or keep everything on this Mac for now.</p>
        <SignInForm onDone={onSignedIn} />
        <button className="login__skip" onClick={onSkip}>Keep it local for now</button>
      </div>
    </div>
  );
}

function Home({ user, shortcut, profile, feed }: { user: string; shortcut: string; profile: Profile | null; feed: FeedItem[] }) {
  return (
    <>
      <div className="topline">
        <h1>Hello again, {user}</h1>
        <div className="avatar">{user[0]?.toUpperCase() ?? 'U'}</div>
      </div>
      <div className="cols">
        <div className="main-col">
          <div className="hero">
            <h2>Understand everything you ship.</h2>
            <p>Highlight code in any app and Unvibe explains it right where you are working — pitched to how much you already know, and quiet until you ask.</p>
            <div className="row">
              <button onClick={() => window.unvibe.companionReview()}>Explain some code</button>
              <span className="kbd">or press {shortcut} anywhere</span>
            </div>
          </div>

          <div className="feed-label">LATELY</div>
          {feed.length === 0 ? (
            <div className="feed-empty">
              <div className="t">Nothing reviewed yet</div>
              <div className="d">Highlight some code and press {shortcut}. The things you review will gather here so you can return to any of them.</div>
            </div>
          ) : (
            <div className="feed">
              {feed.map((f) => (
                <div className="feed-row" key={f.id}>
                  <div className="feed-time">{fmtTime(f.ts)}</div>
                  <div className="feed-main">
                    <div className="feed-title">{f.title}</div>
                    <div className="feed-meta">{f.meta}</div>
                  </div>
                  <span className={`tag tag--${f.outcome}`}>
                    {f.outcome === 'understood' ? 'Understood' : f.outcome === 'needs_review' ? 'Revisit' : 'Reviewed'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rail">
          <div className="stats">
            <div className="stat"><span className="v">{profile?.linesUnderstood ?? 0}</span><span className="l">lines understood</span></div>
            <div className="stat"><span className="v">{profile?.conceptsMastered ?? 0}</span><span className="l">concepts mastered</span></div>
            <div className="stat"><span className="v">{profile?.streak ?? 0}</span><span className="l">day streak</span></div>
          </div>
          <div className="rail-card">
            <div className="t">Kept on your machine</div>
            <div className="d">Code is scanned for secrets on your device before anything is sent. The service never reads your repository.</div>
          </div>
          <div className="rail-card">
            <div className="t">How it works</div>
            <div className="d">Select code, press {shortcut}, pick a depth from New to Expert, then take a quick check to lock it in.</div>
          </div>
        </div>
      </div>
    </>
  );
}

function Progress({ profile }: { profile: Profile | null }) {
  const heat = profile?.heat ?? Array.from({ length: 182 }, () => 0);
  return (
    <>
      <div className="topline"><h1>Progress</h1></div>
      <p className="lead">The honest measure of what you have understood — not lines typed, but lines you could explain to someone else.</p>

      <div className="tiles">
        <div className="tile"><div className="v">{profile?.linesUnderstood ?? 0}</div><div className="l">lines understood</div><div className="note">of {profile?.linesReviewed ?? 0} reviewed</div></div>
        <div className="tile"><div className="v">{profile?.conceptsMastered ?? 0}</div><div className="l">concepts mastered</div><div className="note">{profile?.conceptsSeen ?? 0} seen</div></div>
        <div className="tile"><div className="v">{profile?.reviews ?? 0}</div><div className="l">reviews done</div><div className="note">{profile?.needsReview ?? 0} to revisit</div></div>
        <div className="tile"><div className="v">{profile?.streak ?? 0}</div><div className="l">day streak</div><div className="note">best: {profile?.bestStreak ?? 0} days</div></div>
      </div>

      <div className="panel-card">
        <div className="ph"><span className="t">Your streak</span><span className="m">last 6 months</span></div>
        <div className="heat">
          {heat.map((lvl, i) => <i key={i} className={lvl ? `a${lvl}` : ''} />)}
        </div>
        <div className="heat-legend">
          <span>Less</span><i /><i className="a1" /><i className="a2" /><i className="a3" /><span>More</span>
          <span style={{ marginLeft: 'auto' }}>Review code on a day to light it up.</span>
        </div>
      </div>

      <div className="two">
        <div className="panel-card" style={{ marginBottom: 0 }}>
          <div className="ph"><span className="t">Where you learn</span></div>
          {profile && profile.usage.length > 0 ? (
            <div className="bars">
              {profile.usage.map((u) => (
                <div className="bar-row" key={u.label}>
                  <div className="bl"><span>{u.label}</span><span>{u.pct}%</span></div>
                  <div className="bar-track"><i style={{ width: `${u.pct}%` }} /></div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bars">
              {['Editors & IDEs', 'Terminal', 'Browser & docs'].map((l) => (
                <div className="bar-row" key={l}><div className="bl"><span>{l}</span><span>0%</span></div><div className="bar-track"><i style={{ width: '0%' }} /></div></div>
              ))}
            </div>
          )}
          <p className="soft-note">Unvibe notes which app you were in when you asked — never what you typed.</p>
        </div>
        <div className="panel-card" style={{ marginBottom: 0 }}>
          <div className="ph"><span className="t">Understanding over time</span></div>
          <div className="chart-empty">Your weekly curve of lines understood will draw itself here after a few days of reviewing.</div>
        </div>
      </div>
    </>
  );
}

function Explainer({ page }: { page: PageDef }) {
  return (
    <>
      <div className="topline"><h1>{page.id}<span className="d2">fills in as you review</span></h1></div>
      <p className="lead">{page.lead}</p>
      <div className="feature-grid">
        {page.features.map((f) => (
          <div className="feature" key={f.t}>
            <div className="fh"><Icon d={f.icon} /><span className="t">{f.t}</span></div>
            <div className="d">{f.d}</div>
          </div>
        ))}
      </div>
      <div className="stub"><b>Nothing here yet.</b> This is where your {page.id.toLowerCase()} will live. Review some code with <b>⌥ Space</b> and it starts filling in on its own.</div>
    </>
  );
}

function AccountPanel({ account, onChange }: { account: Account; onChange: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  if (!account) {
    return (
      <>
        <div className="setrow" style={{ display: 'block' }}>
          <div className="sl">Sign in</div>
          <div className="sd" style={{ marginBottom: 14 }}>Sync your learning across devices. You are using Unvibe locally right now.</div>
          <SignInForm onDone={onChange} />
        </div>
      </>
    );
  }

  const del = async () => {
    setBusy(true);
    setErr('');
    const r = (await window.unvibe.deleteAccount()) as { ok: boolean; error?: string };
    setBusy(false);
    if (r.ok) onChange();
    else setErr(r.error ?? 'Could not delete the account.');
  };

  return (
    <>
      <div className="setrow">
        <div><div className="sl">Signed in</div><div className="sd">{account.email}</div></div>
        <button className="act" onClick={async () => { await window.unvibe.signOut(); onChange(); }}>Sign out</button>
      </div>
      <div className="setrow" style={{ display: 'block' }}>
        <div className="sl" style={{ color: '#a1291f' }}>Delete account</div>
        <div className="sd" style={{ marginBottom: 12 }}>Permanently removes your account and every review, concept, and streak — on this Mac and on our servers. This cannot be undone.</div>
        {!confirming ? (
          <button className="act danger" onClick={() => setConfirming(true)}>Delete my account…</button>
        ) : (
          <div className="danger-row">
            <button className="act danger" disabled={busy} onClick={del}>{busy ? 'Deleting…' : 'Yes, delete everything'}</button>
            <button className="act" disabled={busy} onClick={() => setConfirming(false)}>Cancel</button>
          </div>
        )}
        {err && <div className="field-err">{err}</div>}
      </div>
    </>
  );
}

function Settings({ info, account, onAccountChange, onClose }: {
  info: { version: string; shortcut: string };
  account: Account;
  onAccountChange: () => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState('General');
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="mside">
          <div className="mh">SETTINGS</div>
          {['General', 'Overlay', 'Privacy'].map((t) => (
            <button key={t} className={t === tab ? 'on' : ''} onClick={() => setTab(t)}>{t}</button>
          ))}
          <div className="mh" style={{ paddingTop: 18 }}>ACCOUNT</div>
          {['Account', 'Data'].map((t) => (
            <button key={t} className={t === tab ? 'on' : ''} onClick={() => setTab(t)}>{t}</button>
          ))}
          <div className="ver">Unvibe v{info.version}</div>
        </div>
        <div className="mbody">
          <h2>{tab}</h2>
          {tab === 'General' && (
            <>
              <div className="setrow"><div><div className="sl">Trigger</div><div className="sd">Select code, then press {info.shortcut} to open an explanation.</div></div><button className="act" disabled>Change</button></div>
              <div className="setrow"><div><div className="sl">Starting depth</div><div className="sd">Which level new explanations open at — currently Intermediate.</div></div><button className="act" disabled>Change</button></div>
            </>
          )}
          {tab === 'Privacy' && (
            <>
              <div className="setrow"><div><div className="sl">On-device secret scan</div><div className="sd">Every selection is scanned for keys and tokens before it leaves your Mac. Always on.</div></div><button className="act" disabled>On</button></div>
              <div className="setrow"><div><div className="sl">The service never reads your repo</div><div className="sd">Only the exact, filtered snippet you review is sent — nothing else.</div></div></div>
            </>
          )}
          {tab === 'Overlay' && (
            <div className="setrow"><div><div className="sl">Floating bar</div><div className="sd">Position and idle opacity controls arrive in the next update.</div></div><button className="act" disabled>Soon</button></div>
          )}
          {tab === 'Account' && <AccountPanel account={account} onChange={onAccountChange} />}
          {tab === 'Data' && (
            <div className="setrow" style={{ display: 'block' }}>
              <div className="sl">Your data</div>
              <div className="sd">Reviews and progress live in a file on this Mac. Deleting your account (under Account) erases them everywhere.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function App() {
  const [page, setPage] = useState<PageId>('Home');
  const [settings, setSettings] = useState(false);
  const [toast, setToast] = useState('');
  const [info, setInfo] = useState({ version: '0.1.0', user: 'there', shortcut: '⌥ Space' });
  const [account, setAccount] = useState<Account>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [gate, setGate] = useState<'checking' | 'login' | 'app'>('checking');

  const refresh = async () => {
    const [acct, prof, fd] = await Promise.all([
      window.unvibe.account() as Promise<Account>,
      window.unvibe.profile() as Promise<Profile>,
      window.unvibe.feed(8) as Promise<FeedItem[]>,
    ]);
    setAccount(acct);
    setProfile(prof);
    setFeed(fd);
    return acct;
  };

  useEffect(() => {
    void window.unvibe.appInfo().then(setInfo);
    void (async () => {
      const acct = await refresh();
      setGate(acct ? 'app' : 'login');
    })();
    const onFocus = () => void refresh();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(''), 1800);
  };

  if (gate === 'checking') return <div className="titlebar" />;

  if (gate === 'login') {
    return (
      <>
        <div className="titlebar" />
        <LoginScreen
          onSignedIn={async () => { await refresh(); setGate('app'); }}
          onSkip={() => setGate('app')}
        />
      </>
    );
  }

  return (
    <>
      <div className="titlebar" />
      <div className="layout">
        <aside className="side">
          <div className="brand">
            <span className="mark"><LogoMark size={22} /></span>
            <span className="name">Unvibe</span>
            <span className="badge">Beta</span>
          </div>
          <nav className="nav">
            {NAV.map((p) => (
              <button key={p.id} className={p.id === page ? 'on' : ''} onClick={() => setPage(p.id)}>
                <Icon d={p.icon} />{p.id}
              </button>
            ))}
          </nav>
          <div className="spacer" />
          <div className="promo">
            <div className="t">Free while in <em>beta</em></div>
            <div className="d">Everything is unlocked while Unvibe grows up alongside you.</div>
            <button onClick={() => flash('The roadmap is coming together.')}>See the roadmap</button>
          </div>
          <nav className="nav">
            {FOOT.map((f) => (
              <button key={f.id} onClick={() => (f.id === 'Settings' ? setSettings(true) : flash(f.toast))}>
                <Icon d={f.icon} />{f.id}
              </button>
            ))}
          </nav>
        </aside>
        <main className="content">
          <div className="page">
            {page === 'Home' ? (
              <Home user={info.user} shortcut={info.shortcut} profile={profile} feed={feed} />
            ) : page === 'Progress' ? (
              <Progress profile={profile} />
            ) : (
              <Explainer page={PAGES[page]} />
            )}
          </div>
        </main>
      </div>
      {settings && (
        <Settings
          info={info}
          account={account}
          onAccountChange={async () => { const a = await refresh(); if (!a) setGate('app'); }}
          onClose={() => setSettings(false)}
        />
      )}
      {toast && <div className="toast">{toast}</div>}
    </>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
