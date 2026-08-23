let unlocked = false;
let armed = false;
const waiters: Array<() => void> = [];

export function isAudioUnlocked(): boolean {
  return unlocked;
}

export function whenAudioUnlocked(done: () => void): () => void {
  if (unlocked) {
    done();
    return () => undefined;
  }
  waiters.push(done);
  return () => {
    const index = waiters.indexOf(done);
    if (index >= 0) waiters.splice(index, 1);
  };
}

export function armAudioUnlock(): void {
  if (armed || typeof window === "undefined") return;
  armed = true;
  const unlock = () => {
    if (unlocked) return;
    unlocked = true;
    waiters.splice(0).forEach((done) => done());
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
    window.removeEventListener("touchstart", unlock);
  };
  window.addEventListener("pointerdown", unlock);
  window.addEventListener("keydown", unlock);
  window.addEventListener("touchstart", unlock);
}
