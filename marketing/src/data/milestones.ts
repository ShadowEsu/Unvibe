export type MilestoneCategory = "PRODUCT" | "INFRA" | "COMPANY" | "DISTRIBUTION";

export interface Milestone {
  date: string;
  category: MilestoneCategory;
  title: string;
  summary: string;
}

export const milestones: Milestone[] = [
  {
    date: "16 AUG 2026",
    category: "INFRA",
    title: "GitLab for Startups accepted",
    summary: "Accepted into GitLab for Startups with $23,700+ in GitLab Ultimate platform credits for secure, automated DevSecOps operations.",
  },
  {
    date: "29 JUL 2026",
    category: "PRODUCT",
    title: "Build-in-public system",
    summary: "A live founder signal, honest 55% roadmap, and a compact public development record.",
  },
  {
    date: "28 JUL 2026",
    category: "INFRA",
    title: "Selection bridge and production API",
    summary: "The ⌘U capture path, service connection, durable waitlist, and beta demo were hardened.",
  },
  {
    date: "27 JUL 2026",
    category: "DISTRIBUTION",
    title: "Private-beta feedback loop",
    summary: "Tester feedback, referral rewards, listing badges, and release communication went live.",
  },
  {
    date: "24 JUL 2026",
    category: "COMPANY",
    title: "Google startup support and sign-in",
    summary: "Google for Startups support was secured and Google authentication entered the product.",
  },
  {
    date: "22 JUL 2026",
    category: "PRODUCT",
    title: "Native installer and Island",
    summary: "The Mac installer, desktop Island, learning surfaces, and referral beta flow shipped together.",
  },
  {
    date: "22 JUL 2026",
    category: "COMPANY",
    title: "MongoDB for Startups support",
    summary: "Unvibe joined the MongoDB for Startups program and added its first external startup credits.",
  },
  {
    date: "20 JUL 2026",
    category: "COMPANY",
    title: "Investor outreach began",
    summary: "The first investor materials and founder outreach moved Unvibe beyond a private product experiment.",
  },
  {
    date: "16 JUL 2026",
    category: "INFRA",
    title: "Beta infrastructure",
    summary: "Waitlist, pricing, production routes, download delivery, and a real launch surface came online.",
  },
  {
    date: "14 JUL 2026",
    category: "DISTRIBUTION",
    title: "unvibe.site went live",
    summary: "The product received a public home, production domain, and the first developer-facing story.",
  },
  {
    date: "11 JUL 2026",
    category: "PRODUCT",
    title: "Desktop-first pivot",
    summary: "Unvibe became a Mac desktop learning layer built around selection, explanation, recall, and progress.",
  },
];
