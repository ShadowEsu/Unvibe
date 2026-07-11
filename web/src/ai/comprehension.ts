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
      Array.isArray(obj.options) &&
      obj.options.length >= 2 &&
      typeof obj.answerIndex === 'number' &&
      obj.answerIndex >= 0 &&
      obj.answerIndex < obj.options.length
    ) {
      return {
        question: obj.question,
        options: obj.options.map(String),
        answerIndex: obj.answerIndex,
        rationale: typeof obj.rationale === 'string' ? obj.rationale : '',
        concept: typeof obj.concept === 'string' ? obj.concept : 'general',
        conceptLabel: typeof obj.conceptLabel === 'string' ? obj.conceptLabel : 'General',
      };
    }
  } catch {
    return undefined;
  }
  return undefined;
}
