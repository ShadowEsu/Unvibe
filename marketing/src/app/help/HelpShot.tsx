/**
 * Real macOS 15 screens for the help pages: QA's captures of the released Unvibe 0.1.49 DMG (run 42343127453,
 * macOS 15.8.2), cropped to Unvibe's own rows (Security C-4). New captures replace these when the steps change.
 */
export interface HelpShotImage {
  src: string;
  width: number;
  height: number;
  alt: string;
}

export const HELP_SHOTS = {
  question: {
    src: "/unvibe/help/macos15-system-events-question.webp",
    width: 260,
    height: 260,
    alt: "macOS asks: \u201cUnvibe\u201d wants access to control \u201cSystem Events\u201d, with Don't Allow and Allow buttons",
  },
  automation: {
    src: "/unvibe/help/macos15-automation-system-events-off.webp",
    width: 459,
    height: 127,
    alt: "System Settings, Automation: Unvibe listed, with its System Events switch off",
  },
  accessibility: {
    src: "/unvibe/help/macos15-accessibility-unvibe-off.webp",
    width: 459,
    height: 94,
    alt: "System Settings, Accessibility: Unvibe listed, with its switch off",
  },
  // The first-open dialogs, from the /beta install box (InstallBox.tsx): QA's real captures of the 0.1.49 downloads.
  notOpened: {
    src: "/unvibe/install/macos15-not-opened.webp",
    width: 260,
    height: 232,
    alt: "macOS dialog: Unvibe Not Opened, with Done and Move to Trash",
  },
  openAnyway: {
    src: "/unvibe/install/macos15-open-anyway.webp",
    width: 476,
    height: 174,
    alt: "macOS Privacy & Security, Security section: Unvibe was blocked to protect your Mac, with the Open Anyway button",
  },
  smartScreen: {
    src: "/unvibe/install/windows-smartscreen-more-info.webp",
    width: 532,
    height: 498,
    alt: "Windows dialog: Windows protected your PC, with the More info link and Don't run",
  },
  runAnyway: {
    src: "/unvibe/install/windows-smartscreen-run-anyway.webp",
    width: 532,
    height: 498,
    alt: "Windows dialog after More info: App Unvibe-0.1.49-win-x64-portable.exe, Publisher Unknown publisher, with Run anyway and Don't run",
  },
} as const satisfies Record<string, HelpShotImage>;

export function HelpShot({ src, width, height, alt, caption = "Real screen, macOS 15 · Unvibe 0.1.49" }: HelpShotImage & { caption?: string }) {
  return (
    <figure className="help-shot">
      {/* eslint-disable-next-line @next/next/no-img-element -- a small real screenshot, shown at its native size */}
      <img src={src} width={width} height={height} alt={alt} loading="lazy" decoding="async" />
      <figcaption>{caption}</figcaption>
    </figure>
  );
}
