import { createRoot } from 'react-dom/client';
import { LogoMark } from '../shared/logo';

function Bar() {
  return (
    <div className="pill">
      <span className="glyph"><LogoMark size={15} stroke={2} /></span>
      <span className="label">
        <span className="brand">Unvibe</span>
        <span className="hint">
          Review selection<span className="kbd">⌥ ␣</span>
        </span>
      </span>
      <button title="Review selection (⌥ Space)" onClick={() => window.unvibe.reviewSelection()}>
        ▸
      </button>
      <button title="Open Unvibe" onClick={() => window.unvibe.openCompanion()}>
        ⌂
      </button>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<Bar />);
