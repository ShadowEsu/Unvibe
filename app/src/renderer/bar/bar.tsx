import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { LogoMark } from '../shared/logo';

function prettyAccel(accel: string): string {
  return accel.replace('CommandOrControl', '⌘').replace('Control', '⌃').replace('Shift', '⇧').replace('Alt', '⌥');
}

function Bar() {
  const [note, setNote] = useState('');
  const [shortcut, setShortcut] = useState('⌘U');

  useEffect(() => {
    window.unvibe.onBarNotify((msg) => {
      setNote(msg);
      setTimeout(() => setNote(''), 5000);
    });
    window.unvibe.appInfo().then((i) => setShortcut(prettyAccel(i.shortcut)));
  }, []);

  return (
    <div className={`pill${note ? ' pill--note' : ''}`}>
      <span className="glyph"><LogoMark size={15} stroke={2} /></span>
      <span className="label">
        {note ? (
          <span className="note">{note}</span>
        ) : (
          <>
            <span className="brand">Unvibe</span>
            <span className="hint">
              Review selection<span className="kbd">{shortcut}</span>
            </span>
          </>
        )}
      </span>
      <button aria-label="Review selection" onClick={() => window.unvibe.reviewSelection()}>▸</button>
      <button aria-label="Open Unvibe" onClick={() => window.unvibe.openCompanion()}>⌂</button>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<Bar />);
