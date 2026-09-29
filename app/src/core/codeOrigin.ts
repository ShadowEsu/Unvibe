export interface OriginFact {
  label: string;
  value: string;
}

export interface CodeOriginReport {
  file: string;
  lineStart: number;
  lineEnd: number;
  facts: OriginFact[];
  inference: string;
  missing: string[];
}

export function buildOriginReport(input: {
  file: string;
  lineStart: number;
  lineEnd: number;
  blameAuthor?: string;
  blameDate?: string;
  firstCommit?: string;
  firstSubject?: string;
  laterSubjects?: string[];
}): CodeOriginReport {
  const facts: OriginFact[] = [];
  const missing: string[] = [];
  if (input.firstCommit) facts.push({ label: 'Introduced', value: input.firstCommit });
  else missing.push('introducing commit');
  if (input.firstSubject) facts.push({ label: 'Reason documented', value: input.firstSubject });
  else missing.push('commit message');
  if (input.blameAuthor) facts.push({ label: 'Last line author', value: input.blameAuthor });
  if (input.blameDate) facts.push({ label: 'Last line date', value: input.blameDate });
  if (input.laterSubjects?.length) facts.push({ label: 'Later changed', value: input.laterSubjects.slice(0, 4).join(' · ') });
  facts.push({ label: 'Relevant code', value: `${input.file}:${input.lineStart}-${input.lineEnd}` });

  const inference = input.firstSubject
    ? `Inference: the surviving comment or commit text is the only documented reason. Unvibe did not invent history.`
    : 'No documented rationale found.';

  return {
    file: input.file,
    lineStart: input.lineStart,
    lineEnd: input.lineEnd,
    facts,
    inference,
    missing,
  };
}
