// services/router.service.ts
// Deterministic query complexity router (NO LLM)
// Classifies queries as "simple" or "complex" using rule-based heuristics

const COMPLEX_KEYWORDS = [
  'compare',
  'difference',
  'explain',
  'summarize',
  'analyse',
  'analyze',
  'why',
  'how',
  'when',
  'pros',
  'cons',
  'advantages',
  'disadvantages',
  'steps',
  'across',
  'between',
  'vs',
  'versus',
];

const SIMPLE_MODEL = 'llama-3.1-8b-instant';
const COMPLEX_MODEL = 'llama-3.3-70b-versatile';

export interface RouterResult {
  classification: 'simple' | 'complex';
  model_used: string;
}

/**
 * Classify a question as simple or complex.
 *
 * Rules:
 *   - word_count < 8
 *   - AND question does NOT contain any complex keywords
 *   - AND question has <= 1 question mark
 *   → "simple" (llama-3.1-8b-instant)
 *
 *   Otherwise → "complex" (llama-3.3-70b-versatile)
 */
export function classify(question: string): RouterResult {
  const q = question.toLowerCase().trim();
  const words = q.split(/\s+/).filter((w) => w.length > 0);
  const wordCount = words.length;

  const hasComplexKeyword = COMPLEX_KEYWORDS.some((kw) => q.includes(kw));
  const questionMarks = (q.match(/\?/g) || []).length;

  if (wordCount < 8 && !hasComplexKeyword && questionMarks <= 1) {
    return { classification: 'simple', model_used: SIMPLE_MODEL };
  }

  return { classification: 'complex', model_used: COMPLEX_MODEL };
}
