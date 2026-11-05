/**
 * The /use-cases pages: one per search intent from someone who ships code they did not write.
 * Titles and descriptions live here so the index, the sitemap and useCases.test.ts read one list;
 * each page's body is in src/app/use-cases/<slug>/page.tsx. Titles get the layout's " · Unvibe".
 */
export interface UseCase {
  slug: string;
  /** Breadcrumb and index link text. */
  name: string;
  title: string;
  description: string;
  /** One line under the link on /use-cases. */
  summary: string;
}

export const USE_CASES_INDEX = {
  path: "/use-cases",
  title: "Unvibe use cases: AI code, learning, inherited code",
  description:
    "Three times you need to understand code you did not write: an AI agent's change, code AI wrote while you learn, and a codebase you inherited.",
} as const;

export const useCases: readonly UseCase[] = [
  {
    slug: "review-ai-code",
    name: "Review an AI code change",
    title: "Review AI code before you accept it",
    description:
      "What to check in a diff from Cursor, Claude Code or Copilot before you accept or commit it, with a worked TypeScript example.",
    summary: "An agent just changed your code. What to check in the diff before you accept or commit it.",
  },
  {
    slug: "learn-to-code-with-ai",
    name: "Learn to code with AI",
    title: "Learn to code from the code AI writes for you",
    description:
      "For students and beginners who build with AI: how to read what it wrote, a worked Python example, and explanations at the New or Beginner depth.",
    summary: "You build with AI and want to understand what it wrote, at your level.",
  },
  {
    slug: "inherited-code",
    name: "Code you didn't write",
    title: "Understand code you didn't write",
    description:
      "How to read an unfamiliar file top-down before you change it, with a worked JavaScript example, from callers and imports to tests and git history.",
    summary: "A teammate's code, an old project or an open-source repo. How to read a file before you change it.",
  },
];

export const pathForUseCase = (useCase: UseCase): string => `${USE_CASES_INDEX.path}/${useCase.slug}`;

export const USE_CASE_PATHS: readonly string[] = [USE_CASES_INDEX.path, ...useCases.map(pathForUseCase)];

export function findUseCase(slug: string): UseCase {
  const found = useCases.find((entry) => entry.slug === slug);
  if (!found) throw new Error(`No use case "${slug}"`);
  return found;
}
