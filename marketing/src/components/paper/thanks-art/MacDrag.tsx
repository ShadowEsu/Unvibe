import { INK, Scene } from "./parts";

/** Mac step 2: the "Install Unvibe" disk image window, the app icon, an arrow, the Applications folder. */
export function MacDrag() {
  return (
    <Scene>
      <rect x="20" y="26" width="200" height="128" rx="14" fill="#fff" {...INK} />
      <path d="M20 52h200" fill="none" {...INK} />
      <circle cx="36" cy="39" r="4" fill="#fff" {...INK} />
      <circle cx="50" cy="39" r="4" fill="#fff" {...INK} />
      <text className="thanks-art__label" x="120" y="43" textAnchor="middle">Install Unvibe</text>
      <g className="thanks-art__nudge">
        <rect x="46" y="74" width="48" height="48" rx="12" fill="#141414" />
        <circle cx="70" cy="98" r="9" fill="#d6f45a" />
      </g>
      <path d="M108 98h30m-8-8l8 8-8 8" fill="none" {...INK} />
      <path d="M150 80h22l6 6h18v38h-46z" fill="#9fd8ff" {...INK} />
      <text className="thanks-art__label thanks-art__label--small" x="173" y="140" textAnchor="middle">Applications</text>
    </Scene>
  );
}
