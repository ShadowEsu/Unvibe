/**
 * Design's 0.1.51 motion ruling: every remaining loop pauses while the window is away. "Away" is the panel's own
 * meaning (widget.tsx `away`): hidden, or another app in front after this window had focus. It is never set at start,
 * so the panel, which opens with showInactive() beside the editor, keeps its loops (the thinking dots, the caret)
 * while you read. CSS pauses loops under `:root[data-away]` (buddy.css, widget.css).
 *
 * Marks the document `data-away` while this window is hidden or has lost focus; returns a cleanup.
 */
export function trackWindowAway(root: HTMLElement = document.documentElement): () => void {
  const away = () => root.setAttribute('data-away', '');
  const back = () => root.removeAttribute('data-away');
  const onVisibility = () => (document.hidden ? away() : document.hasFocus() && back());
  window.addEventListener('blur', away);
  window.addEventListener('focus', back);
  document.addEventListener('visibilitychange', onVisibility);
  return () => {
    window.removeEventListener('blur', away);
    window.removeEventListener('focus', back);
    document.removeEventListener('visibilitychange', onVisibility);
  };
}
