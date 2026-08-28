export type BuildMapKind = "done" | "fail" | "now" | "next";
export type BuildMapAlign = "above" | "below";

export interface BuildMapNode {
  id: string;
  label: string;
  kind: BuildMapKind;
  x: number;
  y: number;
  align: BuildMapAlign;
}

export const BUILD_MAP_WIDTH = 1000;
export const BUILD_MAP_HEIGHT = 600;

export const buildMapNodes: BuildMapNode[] = [
  { id: "idea", label: "Idea", kind: "done", x: 80, y: 110, align: "above" },
  { id: "mvp", label: "MVP", kind: "done", x: 290, y: 90, align: "above" },
  { id: "privateBeta", label: "Beta", kind: "done", x: 510, y: 130, align: "above" },
  { id: "errors", label: "Errors", kind: "fail", x: 730, y: 80, align: "above" },
  { id: "siteDown", label: "Site down", kind: "fail", x: 880, y: 250, align: "above" },
  { id: "fixing", label: "Fixing", kind: "done", x: 670, y: 300, align: "below" },
  { id: "liveTesting", label: "Live testing", kind: "done", x: 450, y: 250, align: "above" },
  { id: "testers", label: "Testers", kind: "done", x: 220, y: 310, align: "below" },
  { id: "wider", label: "Wider", kind: "next", x: 90, y: 470, align: "below" },
  { id: "proAccounts", label: "Pro", kind: "next", x: 320, y: 510, align: "below" },
  { id: "consults", label: "Consults", kind: "done", x: 560, y: 460, align: "below" },
  { id: "publicBeta", label: "Public", kind: "now", x: 800, y: 520, align: "below" },
];

export const buildMapRoad = [
  "M 80 110",
  "C 150 40, 220 170, 290 90",
  "C 370 0, 440 200, 510 130",
  "C 590 50, 660 10, 730 80",
  "C 830 170, 940 170, 880 250",
  "C 820 330, 750 360, 670 300",
  "C 590 240, 520 180, 450 250",
  "C 360 340, 290 240, 220 310",
  "C 140 390, 40 390, 90 470",
  "C 160 560, 250 560, 320 510",
  "C 410 450, 490 390, 560 460",
  "C 650 540, 730 450, 800 520",
].join(" ");
