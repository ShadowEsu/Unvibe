import type { FlexAccordionItem } from "@/components/paper/FlexAccordion";

const panelShot = (name: string, alt: string) => ({ src: `/unvibe/real/${name}.webp`, width: 880, height: 1131, alt });

/**
 * The home page's four-step loop in the panel (components/paper/HowItWorks). Plain data, so the home
 * page's HowTo JSON-LD and /llms-full.txt state exactly these visible steps without importing UI.
 */
export const STEPS: readonly FlexAccordionItem[] = [
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
    image: panelShot("panel-beginner", "The same explanation rewritten at the Beginner depth"),
  },
  {
    id: "ask",
    label: "Ask",
    title: "Ask what still doesn't click.",
    body: "Type a follow-up under the explanation.",
    image: panelShot("panel-follow-up", "A typed follow-up question answered in the Unvibe panel"),
  },
  {
    id: "test",
    label: "Test me",
    title: "Check that it stuck.",
    body: "Test me writes a question about this exact code.",
    image: panelShot("panel-test-me", "A multiple-choice Test me question about the debounce function"),
  },
];
