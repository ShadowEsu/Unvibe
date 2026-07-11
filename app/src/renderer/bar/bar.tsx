import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { LogoMark } from '../shared/logo';

function Bar() {
  const [note, setNote] = useState('');

  useEffect(() => {
    window.unvibe.onBarNotify((msg) => {
      setNote(msg);
      setTimeout(() => setNote(''), 5000);
    });
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
              Review selection<span className="kbd">⌘⌥U</span>
            </span>
          </>
        )}
      </span>
      <button title="Review selection" onClick={() => window.unvibe.reviewSelection()}>▸</button>
      <button title="Open Unvibe" onClick={() => window.unvibe.openCompanion()}>⌂</button>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<Bar />);
