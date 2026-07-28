export interface Question {
  question: string;
  options: string[];
  answerIndex: number;
  rationale: string;
  concept: string;
  conceptLabel: string;
}

/** Parse the model's JSON, tolerating code fences and surrounding prose; validate the shape. */
export function parseQuestion(text: string): Question | undefined {
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) {
    return undefined;
  }
  try {
    const obj = JSON.parse(cleaned.slice(start, end + 1)) as Partial<Question>;
    if (
      typeof obj.question === 'string' &&
      obj.question.trim().length > 0 &&
      Array.isArray(obj.options) &&
      obj.options.length >= 2 &&
      obj.options.every((o) => typeof o === 'string' && o.trim().length > 0) &&
      typeof obj.answerIndex === 'number' &&
      obj.answerIndex >= 0 &&
      obj.answerIndex < obj.options.length &&
      typeof obj.rationale === 'string' &&
      obj.rationale.trim().length > 0
    ) {
      return {
        question: obj.question.trim(),
        options: obj.options.map((o: string) => o.trim()),
        answerIndex: obj.answerIndex,
        rationale: obj.rationale.trim(),
        concept: typeof obj.concept === 'string' && obj.concept.trim().length > 0 ? obj.concept.trim() : 'general',
        conceptLabel: typeof obj.conceptLabel === 'string' && obj.conceptLabel.trim().length > 0 ? obj.conceptLabel.trim() : 'General',
      };
    }
  } catch {
    return undefined;
  }
  return undefined;
}
