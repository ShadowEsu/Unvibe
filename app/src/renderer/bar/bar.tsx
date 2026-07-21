import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { LogoMark } from '../shared/logo';

function PlayIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M8.2 5.4c-.7-.4-1.5.1-1.5.9v11.4c0 .8.8 1.3 1.5.9l9.8-5.7c.7-.4.7-1.4 0-1.8L8.2 5.4z" />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4.5 11.2 12 4.8l7.5 6.4" />
      <path d="M7.2 10.2V19h9.6v-8.8" />
    </svg>
  );
}

/** Landscape aisle: play · logo · home. Original Unvibe chrome, Wispr-scale quietness. */
function Bar() {
  const [note, setNote] = useState('');

  useEffect(() => {
    window.unvibe.onBarNotify((msg) => {
      setNote(msg);
      setTimeout(() => setNote(''), 4000);
    });
  }, []);

  return (
    <div className={`pill${note ? ' pill--note' : ''}`} title={note || 'Unvibe is ready'}>
      <button className="chip chip--play" aria-label="Start review" title="Start review" onClick={() => window.unvibe.reviewSelection()}>
        <PlayIcon />
      </button>
      <span className="mark" aria-hidden="true">
        <LogoMark size={15} stroke={2.1} />
      </span>
      <span className="pill__status" aria-live="polite">{note || 'Ready to explain'}</span>
      <button className="chip chip--home" aria-label="Open home" title="Home" onClick={() => window.unvibe.openCompanion()}>
        <HomeIcon />
      </button>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<Bar />);
