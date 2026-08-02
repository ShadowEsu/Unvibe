export interface RevealState {
  initial: string;
  animate: boolean;
}

export function revealInitialState(reduceMotion: boolean, phase: string, text: string): RevealState {
  if (reduceMotion) return { initial: text, animate: false };
  if (phase !== 'streaming' && phase !== 'done') return { initial: '', animate: false };
  if (text.length === 0) return { initial: '', animate: false };
  return { initial: '', animate: true };
}
