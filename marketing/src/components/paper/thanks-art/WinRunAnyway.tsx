import { INK, Pointer, RingedButton, Scene } from "./parts";

/** Windows step 3: a plain warning panel (not Microsoft's dialog), More info then Run anyway ringed. */
export function WinRunAnyway() {
  return (
    <Scene>
      <rect x="20" y="26" width="200" height="128" rx="14" fill="#fff" {...INK} />
      <rect x="36" y="44" width="120" height="10" rx="5" fill="#141414" />
      <rect x="36" y="64" width="168" height="8" rx="4" fill="#e9e5d8" />
      <rect className="thanks-art__ring" x="30" y="83" width="68" height="20" rx="7" fill="none" stroke="#d6f45a" strokeWidth={6} />
      <text className="thanks-art__label thanks-art__label--link" x="36" y="97">More info</text>
      <RingedButton x={118} y={114} width={86} label="Run anyway" />
      <Pointer x={200} y={136} />
    </Scene>
  );
}
