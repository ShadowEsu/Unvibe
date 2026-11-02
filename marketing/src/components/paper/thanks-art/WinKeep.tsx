import { INK, Pointer, RingedButton, Scene } from "./parts";

/** Windows step 1: a browser window with its download bubble, Keep ringed. */
export function WinKeep() {
  return (
    <Scene>
      <rect x="20" y="24" width="200" height="132" rx="14" fill="#fff" {...INK} />
      <path d="M20 48h200" fill="none" {...INK} />
      <rect x="96" y="58" width="112" height="78" rx="10" fill="#fff" {...INK} />
      <rect x="108" y="70" width="64" height="8" rx="4" fill="#e9e5d8" />
      <rect x="108" y="84" width="88" height="8" rx="4" fill="#e9e5d8" />
      <RingedButton x={148} y={102} width={48} label="Keep" />
      <Pointer x={193} y={122} />
    </Scene>
  );
}
