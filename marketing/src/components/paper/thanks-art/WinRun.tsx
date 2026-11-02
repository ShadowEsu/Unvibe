import { INK, Pointer, Scene } from "./parts";

/** Windows step 2: the Downloads folder with an .exe tile and our pointer on it. */
export function WinRun() {
  return (
    <Scene>
      <rect x="40" y="30" width="160" height="120" rx="14" fill="#fff" {...INK} />
      <text className="thanks-art__label" x="56" y="54">Downloads</text>
      <rect x="86" y="70" width="68" height="44" rx="8" fill="#fff3c4" {...INK} />
      <text className="thanks-art__label" x="120" y="97" textAnchor="middle">.exe</text>
      <rect x="72" y="124" width="96" height="8" rx="4" fill="#e9e5d8" />
      <Pointer x={150} y={108} settle />
    </Scene>
  );
}
