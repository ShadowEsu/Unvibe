import { createRoot } from 'react-dom/client';

function Bar() {
  return (
    <div className="pill">
      <span className="glyph">◆</span>
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
