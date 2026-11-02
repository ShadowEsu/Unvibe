import { INK, Pointer, Scene } from "./parts";

/** Mac step 1: the Downloads stack in the Dock, a .dmg tile in it, our pointer on the tile. */
export function MacDownloads() {
  return (
    <Scene>
      <rect x="24" y="118" width="192" height="44" rx="14" fill="#fff" {...INK} />
      <rect x="44" y="128" width="24" height="24" rx="6" fill="#9fd8ff" {...INK} />
      <rect x="80" y="128" width="24" height="24" rx="6" fill="#ffd84d" {...INK} />
      <rect x="136" y="128" width="24" height="24" rx="6" fill="#d6f45a" {...INK} />
      <rect x="172" y="128" width="24" height="24" rx="6" fill="#fff" {...INK} />
      <rect x="110" y="40" width="96" height="62" rx="12" fill="#fff" {...INK} />
      <text className="thanks-art__label" x="158" y="60" textAnchor="middle">Downloads</text>
      <rect x="124" y="68" width="68" height="24" rx="6" fill="#eaf5fe" {...INK} />
      <text className="thanks-art__label" x="158" y="84" textAnchor="middle">.dmg</text>
      <path d="M158 102v14" fill="none" {...INK} />
      <Pointer x={188} y={86} settle />
    </Scene>
  );
}
