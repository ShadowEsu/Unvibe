import { BetaInstall } from "@/components/paper/BetaInstall";

export function ShortcutKeys() {
  return (
    <div className="paper-keys-stage">
      <div className="paper-keys-tray">
        <div className="paper-keys" aria-label="Command U">
          <button type="button" className="paper-key" aria-label="Command">
            <span className="paper-key__mod">⌘</span>
            <span className="paper-key__word">command</span>
          </button>
          <span className="paper-keys__plus" aria-hidden="true">+</span>
          <button type="button" className="paper-key" aria-label="U">
            <span className="paper-key__letter">U</span>
          </button>
        </div>
      </div>
      <p className="paper-caption">The overlay opens on the code you selected.</p>
      <BetaInstall tone="page" showFeedback={false} />
    </div>
  );
}
