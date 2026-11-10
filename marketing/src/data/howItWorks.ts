import { CAPTURE_DIR, SHOT_CAPTION } from "@/data/homeGallery";

export interface HowStep {
  id: string;
  label: string;
  title: string;
  /** One line under the title; none when the title says it all. */
  body?: string;
  image: { src: string; width: number; height: number; alt: string };
  /** The caption for a real screenshot (data/homeGallery SHOT_CAPTION), shown with the step. */
  caption?: string;
}

const panelShot = (name: string, alt: string) => ({ src: `/unvibe/real/${name}.webp`, width: 880, height: 1131, alt });
/** A released 0.1.49 capture (data/homeGallery: CI run 42134140324, sample code). */
const shot0149 = (name: string, alt: string) => ({ src: `${CAPTURE_DIR}/${name}.webp`, width: 704, height: 905, alt });

/**
 * The home page's four-step loop in the panel (components/paper/HowItWorks). Plain data, so the home
 * page's HowTo JSON-LD and /llms-full.txt state exactly these visible steps without importing UI.
 */
export const STEPS: readonly HowStep[] = [
  {
    id: "explain",
    label: "Explain",
    title: "Select code. Press the shortcut.",
    image: panelShot("panel-explained-top", "The Unvibe panel explaining a JavaScript debounce function, with depth buttons along the top"),
  },
  {
    id: "depth",
    label: "Depth",
    title: "Pick how deep it goes.",
    body: "New, Beginner, Intermediate and Advanced are free. Expert is part of Pro.",
    image: shot0149("panel-beginner", "The debounce sample explained at the Beginner depth"),
    caption: SHOT_CAPTION,
  },
  {
    id: "ask",
    label: "Ask",
    title: "Ask what still doesn't click.",
    body: "Type a follow-up under the explanation.",
    image: shot0149("panel-follow-up", "A follow-up question about the debounce sample answered in the Unvibe panel"),
    caption: SHOT_CAPTION,
  },
  {
    id: "test",
    label: "Test me",
    title: "Check that it stuck.",
    body: "Test me writes a question about this exact code, and up to 3 if you want more.",
    image: shot0149("panel-test-me", "A multiple-choice Test me question about the debounce sample"),
    caption: SHOT_CAPTION,
  },
];
