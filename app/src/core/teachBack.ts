export type TeachMark = 'covered' | 'partial' | 'missed';

export interface TeachCheck {
  topic: string;
  mark: TeachMark;
}

export interface TeachBackResult {
  checks: TeachCheck[];
  evidence: 'STRONG' | 'MODERATE' | 'THIN' | 'NOT_ENOUGH';
  note: string;
}

function phrases(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\n.;]+/)
    .map((part) => part.replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim())
    .filter((part) => part.split(' ').length >= 3)
    .slice(0, 8);
}

function overlap(a: string, b: string): number {
  const left = new Set(a.split(' ').filter((w) => w.length > 3));
  const right = new Set(b.split(' ').filter((w) => w.length > 3));
  if (left.size === 0) return 0;
  let hit = 0;
  for (const word of left) if (right.has(word)) hit += 1;
  return hit / left.size;
}

export function gradeTeachBack(explanation: string, answer: string): TeachBackResult {
  const topics = phrases(explanation);
  if (topics.length === 0 || answer.trim().length < 12) {
    return {
      checks: [],
      evidence: 'NOT_ENOUGH',
      note: 'Not enough evidence. Write a real explanation of this specific change.',
    };
  }
  const checks = topics.map((topic) => {
    const score = overlap(topic, answer.toLowerCase());
    const mark: TeachMark = score >= 0.45 ? 'covered' : score >= 0.22 ? 'partial' : 'missed';
    return { topic: topic.slice(0, 80), mark };
  });
  const covered = checks.filter((c) => c.mark === 'covered').length;
  const ratio = covered / checks.length;
  const evidence = ratio >= 0.67 ? 'STRONG' : ratio >= 0.4 ? 'MODERATE' : 'THIN';
  return {
    checks,
    evidence,
    note: 'This is evidence about this explanation, not an intelligence score.',
  };
}
