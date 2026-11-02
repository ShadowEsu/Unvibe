import { Pointer, RingedButton, Scene, INK } from "./parts";

/** Mac step 3: a Privacy & Security panel saying Unvibe was blocked, with Open Anyway ringed. */
export function MacOpenAnyway() {
  return (
    <Scene>
      <rect x="20" y="30" width="200" height="120" rx="14" fill="#fff" {...INK} />
      <text className="thanks-art__label" x="36" y="56">Privacy &amp; Security</text>
      <text className="thanks-art__label thanks-art__label--quiet" x="36" y="84">Unvibe was blocked…</text>
      <rect x="36" y="94" width="120" height="8" rx="4" fill="#e9e5d8" />
      <RingedButton x={118} y={112} width={86} label="Open Anyway" />
      <Pointer x={200} y={134} />
    </Scene>
  );
}
