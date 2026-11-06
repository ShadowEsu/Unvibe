/**
 * The home page's real app gallery (BOSS 5 Nov 16:4x for Preston: "show more of the app, screenshots"; the static
 * version of Design's ledger 530 spec §5). Every picture is a screenshot of the released Unvibe 0.1.49, taken by
 * app/e2e/marketing-media.mjs on GitHub's macOS runner (real-device-test.yml run 42134140324, QA install
 * qa-media-42134140324-1, 6 Nov 00:04Z) with sample code only: the app's built-in debounce sample, 3 pasted snippets,
 * a sample git project, and a snippet holding a fake key (sk_test_ + 24 x's). Nothing in a picture is redrawn;
 * the files are resized only (704 px wide, 2x the cards' width).
 */
export const CAPTURE_VERSION = "0.1.49";

/** The caption every real screenshot on the home page carries. */
export const SHOT_CAPTION = `Real screen, sample code · Unvibe ${CAPTURE_VERSION}`;

export const CAPTURE_DIR = "/unvibe/real/0149";

/**
 * The hero's recording of the panel at work (Design 530 §13.1, PR-D): the same CI run's own recording of the panel
 * window (raw/03-widget.html.webm, sha256 8e9e9ec9…), cropped to the panel (622x800 at x 328) and cut, never sped up,
 * between actions: the first answer (0.3-3.5 s), Beginner (13.8-19.0), Advanced (22.8-29.0), then Test me's question
 * (80.0-83.5). The editor beside it is the site's drawing of the selection and the shortcut, not a recording; CI
 * cannot select in an editor or press the shortcut. The poster is the recording's frame at 29.0 s, Advanced finished.
 */
export const HERO_RECORDING = {
  mp4: `${CAPTURE_DIR}/hero-panel-0149.mp4`,
  webm: `${CAPTURE_DIR}/hero-panel-0149.webm`,
  poster: { src: `${CAPTURE_DIR}/hero-panel-0149-poster.webp`, width: 622, height: 800 },
  /** Length of the cut, in seconds. */
  seconds: 18.125,
  alt: "Unvibe's panel explaining the debounce sample at Advanced depth",
  caption: `Real app, sample code · Unvibe ${CAPTURE_VERSION}`,
} as const;

export interface GalleryShot {
  src: string;
  width: number;
  height: number;
  alt: string;
  /** The depth named on the picture (the Depths card shows two). */
  depth?: string;
}

export interface GalleryCard {
  id: string;
  title: string;
  line: string;
  shots: GalleryShot[];
}

const PANEL = { width: 704, height: 905 };
const WINDOW = { width: 704, height: 440 };

export const KEY_CHECK_SHOT: GalleryShot = {
  src: `${CAPTURE_DIR}/panel-key-check.webp`,
  width: 704,
  height: 854,
  alt: "Unvibe's panel showing Blocked: credential detected, stripe-key, with the key masked, and Nothing was sent.",
};

export const GALLERY: readonly GalleryCard[] = [
  {
    id: "depths",
    title: "Depths",
    line: "The same code at Beginner and at Advanced. Pick the depth that fits you.",
    shots: [
      { src: `${CAPTURE_DIR}/panel-beginner.webp`, ...PANEL, depth: "Beginner", alt: "Unvibe's panel explaining the debounce sample at Beginner depth." },
      { src: `${CAPTURE_DIR}/panel-advanced.webp`, ...PANEL, depth: "Advanced", alt: "Unvibe's panel explaining the same debounce sample at Advanced depth." },
    ],
  },
  {
    id: "follow-up",
    title: "Follow-up",
    line: "Ask about the code in your own words. The answer goes under the explanation.",
    shots: [{ src: `${CAPTURE_DIR}/panel-follow-up.webp`, ...PANEL, alt: "Unvibe's panel answering a follow-up question about the debounce sample under its explanation." }],
  },
  {
    id: "test-me",
    title: "Test me",
    line: "A question about the code you just read, with choices to pick from.",
    shots: [{ src: `${CAPTURE_DIR}/panel-test-me.webp`, ...PANEL, alt: "Unvibe's Test me question about the debounce sample, with its answer choices, beside the explanation." }],
  },
  {
    id: "key-check",
    title: "Key check",
    line: "Code with a known key in it is stopped on your computer. Nothing is sent.",
    shots: [KEY_CHECK_SHOT],
  },
  {
    id: "library",
    title: "Library",
    line: "Every explanation is saved on your computer, to read again later.",
    shots: [{ src: `${CAPTURE_DIR}/library.webp`, ...WINDOW, alt: "Unvibe's Library listing 4 saved explanations from today." }],
  },
  {
    id: "briefs",
    title: "Briefs",
    line: "A recap of what changed in a project, read from local git.",
    shots: [{ src: `${CAPTURE_DIR}/briefs-open.webp`, ...WINDOW, alt: "Unvibe's Change Brief for a sample project's change to upload.js: 1 file changed, 4 lines added." }],
  },
  {
    id: "privacy",
    title: "Privacy",
    line: "What is sent, what stays on your computer, and the switches for it.",
    shots: [{ src: `${CAPTURE_DIR}/settings-privacy.webp`, ...WINDOW, alt: "Unvibe's Settings open at Privacy & Data." }],
  },
];
