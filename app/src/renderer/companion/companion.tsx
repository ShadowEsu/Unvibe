import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

type Page =
  | 'Home'
  | 'Insights'
  | 'Projects'
  | 'Study'
  | 'Concepts'
  | 'Snippets'
  | 'Briefings'
  | 'Library'
  | 'Profile';

const PAGES: Array<{ id: Page; icon: string; desc: string }> = [
  { id: 'Home', icon: 'M3 9.5 10 3l7 6.5V17H3z M8 17v-5h4v5', desc: '' },
  { id: 'Insights', icon: 'M4 16V9 M10 16V4 M16 16v-6', desc: 'Learning analytics — lines reviewed, concept mastery, weekly streak, and progress over time.' },
  { id: 'Projects', icon: 'M3 6a1 1 0 0 1 1-1h4l2 2h6a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z', desc: 'Every repository Unvibe knows — summaries, understanding percentage, and architecture overviews.' },
  { id: 'Study', icon: 'M4 4h9a3 3 0 0 1 3 3v9a3 3 0 0 0-3-3H4z M4 4v9', desc: 'Learning paths generated from your own repositories — frontend, backend, security, architecture, and more.' },
  { id: 'Concepts', icon: 'M10 3l2.1 4.9L17 10l-4.9 2.1L10 17l-2.1-4.9L3 10l4.9-2.1z', desc: 'Your personal coding knowledge base — definitions, examples from your projects, related concepts, and quizzes.' },
  { id: 'Snippets', icon: 'M7 7 3 10l4 3 M13 7l4 3-4 3 M11 4 9 16', desc: 'Saved explanations, diagrams, notes, and AI conversations — the stuff worth keeping.' },
  { id: 'Briefings', icon: 'M5 3h10v14H5z M8 7h4 M8 10h4 M8 13h2', desc: 'Daily and weekly AI learning reports about what changed and what you learned.' },
  { id: 'Library', icon: 'M4 3h3v14H4z M9 3h3v14H9z M14 4l3 .8-3.4 12.6-2.9-.8z', desc: 'Articles, tutorials, roadmaps, and reference material matched to your concepts.' },
  { id: 'Profile', icon: 'M10 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M4 17c.7-3 3-4.5 6-4.5s5.3 1.5 6 4.5', desc: 'Learning statistics, achievements, projects, concept mastery, and review history.' },
];

const FOOT: Array<{ id: string; icon: string }> = [
  { id: 'Invite your team', icon: 'M8 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M2.5 17c.6-2.8 2.7-4.2 5.5-4.2 M14 7v6 M11 10h6' },
  { id: 'Get a free month', icon: 'M3 8h14v9H3z M3 8l2-4h10l2 4 M10 8v9' },
  { id: 'Settings', icon: 'M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z M10 2.8l1 2.2 2.4-.6 1.2 2-1.7 1.8.8 2.3-2.2 1-.1 2.5H9.6l-.1-2.5-2.2-1 .8-2.3-1.7-1.8 1.2-2 2.4.6z' },
  { id: 'Help', icon: 'M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16z M7.8 7.5A2.3 2.3 0 0 1 12.2 8c0 1.5-2.2 1.7-2.2 3 M10 14h.01' },
];

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 20 20" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

function Home({ user, shortcut }: { user: string; shortcut: string }) {
  return (
    <>
      <div className="topline">
        <h1>Welcome back, {user}</h1>
        <div className="avatar">{user[0]?.toUpperCase() ?? 'U'}</div>
      </div>
      <div className="cols">
        <div className="main-col">
          <div className="hero">
            <h2>
              Understand everything <em>you</em> ship.
            </h2>
            <p>Select code in any app and Unvibe explains it beside you — at your level.</p>
            <button onClick={() => window.unvibe.companionReview()}>Review something now</button>
            <span className="kbd">{shortcut} anywhere</span>
          </div>
          <div className="feed-label">TODAY</div>
          <div className="feed-empty">
            <div className="t">No reviews yet today</div>
            <div className="d">Highlight code in your editor and press {shortcut} — your history will appear here.</div>
          </div>
        </div>
        <div className="rail">
          <div className="stats">
            <div className="stat"><span className="v">0</span><span className="l">lines reviewed</span></div>
            <div className="stat"><span className="v">0</span><span className="l">concepts mastered</span></div>
            <div className="stat"><span className="v">0</span><span className="l">day streak</span></div>
          </div>
          <div className="rail-card">
            <div className="t">Learning profile</div>
            <div className="d">Your report unlocks after your first few reviews.</div>
            <button className="cta" disabled title="Coming in Milestone D2">
              Create report
            </button>
          </div>
          <div className="rail-card">
            <div className="t">20 lines a day</div>
            <div className="d">Understand 20 lines of code every day to build your streak.</div>
            <div className="progress"><i style={{ width: '0%' }} /></div>
            <div className="progress-label">0 / 20 lines</div>
          </div>
        </div>
      </div>
    </>
  );
}

function EmptyPage({ page }: { page: (typeof PAGES)[number] }) {
  return (
    <div className="empty-page">
      <h1>
        {page.id}
        <span className="d2">Milestone D2</span>
      </h1>
      <p className="desc">{page.desc}</p>
      <div className="box">This area lights up as your reviews and projects accumulate.</div>
    </div>
  );
}

function Settings({ info, onClose }: { info: { version: string; shortcut: string }; onClose: () => void }) {
  const [tab, setTab] = useState('General');
  const tabs = ['General', 'Overlay', 'Privacy'];
  const account = ['Account', 'Data and Privacy'];
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="mside">
          <div className="mh">SETTINGS</div>
          {tabs.map((t) => (
            <button key={t} className={t === tab ? 'on' : ''} onClick={() => setTab(t)}>{t}</button>
          ))}
          <div className="mh" style={{ paddingTop: 18 }}>ACCOUNT</div>
          {account.map((t) => (
            <button key={t} className={t === tab ? 'on' : ''} onClick={() => setTab(t)}>{t}</button>
          ))}
          <div className="ver">Unvibe v{info.version}</div>
        </div>
        <div className="mbody">
          <h2>{tab}</h2>
          {tab === 'General' ? (
            <>
              <div className="setrow">
                <div><div className="sl">Shortcut</div><div className="sd">Select code, then press {info.shortcut}</div></div>
                <button className="act" disabled title="Milestone D2">Change</button>
              </div>
              <div className="setrow">
                <div><div className="sl">Explanation level</div><div className="sd">Default level for new reviews — Intermediate</div></div>
                <button className="act" disabled title="Milestone D2">Change</button>
              </div>
              <div className="setrow">
                <div><div className="sl">Service</div><div className="sd">http://localhost:8787 · secrets are filtered on-device before anything is sent</div></div>
                <button className="act" disabled title="Milestone D2">Change</button>
              </div>
            </>
          ) : (
            <div className="setrow">
              <div><div className="sl">{tab}</div><div className="sd">Coming in Milestone D2.</div></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function App() {
  const [page, setPage] = useState<Page>('Home');
  const [settings, setSettings] = useState(false);
  const [toast, setToast] = useState('');
  const [info, setInfo] = useState({ version: '0.1.0', user: 'there', shortcut: '⌥ Space' });

  useEffect(() => {
    void window.unvibe.appInfo().then(setInfo);
  }, []);

  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(''), 1800);
  };

  const active = PAGES.find((p) => p.id === page)!;

  return (
    <>
      <div className="titlebar" />
      <div className="layout">
        <aside className="side">
          <div className="brand">
            <span className="mark">◆</span>
            <span className="name">Unvibe</span>
            <span className="badge">Beta</span>
          </div>
          <nav className="nav">
            {PAGES.map((p) => (
              <button key={p.id} className={p.id === page ? 'on' : ''} onClick={() => setPage(p.id)}>
                <Icon d={p.icon} />
                {p.id}
              </button>
            ))}
          </nav>
          <div className="spacer" />
          <div className="beta-card">
            <div className="t">Early build — <em>free in beta</em></div>
            <div className="d">Everything is free while Unvibe learns alongside you.</div>
            <button onClick={() => flash('Thanks — pricing comes much later.')}>What's coming</button>
          </div>
          <nav className="nav">
            {FOOT.map((f) => (
              <button
                key={f.id}
                onClick={() =>
                  f.id === 'Settings' ? setSettings(true) : flash(`${f.id} — coming soon`)
                }
              >
                <Icon d={f.icon} />
                {f.id}
              </button>
            ))}
          </nav>
        </aside>
        <main className="content">
          <div className="page">
            {page === 'Home' ? (
              <Home user={info.user} shortcut={info.shortcut} />
            ) : (
              <EmptyPage page={active} />
            )}
          </div>
        </main>
      </div>
      {settings && <Settings info={info} onClose={() => setSettings(false)} />}
      {toast && <div className="toast">{toast}</div>}
    </>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
