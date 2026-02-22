// services/evaluator.service.ts
// Post-response quality evaluator
// Returns an array of diagnostic flags based on retrieval and answer analysis

const REFUSAL_PHRASES = [
  'not found',
  'cannot find',
  'do not have',
  'not mentioned',
  "i don't know",
];

/**
 * Evaluate the quality of a response and return diagnostic flags.
 *
 * Flags:
 *   - "no_context"     : No chunks retrieved AND answer is not a refusal
 *   - "refusal"        : Answer contains known refusal phrases
 *   - "low_similarity" : Top similarity score is below 0.60
 *                        (only when chunks_retrieved == 0 or topScore < 0.60)
 *
 * @param chunksRetrieved - Number of chunks that passed similarity threshold
 * @param topScore        - Highest similarity score from retrieval
 * @param answer          - LLM-generated answer text
 * @returns Array of flag strings (may be empty)
 */
export function evaluate(
  chunksRetrieved: number,
  topScore: number,
  answer: string
): string[] {
  const flags: string[] = [];
  const lowerAnswer = answer.toLowerCase();

  // Check for refusal
  const isRefusal = REFUSAL_PHRASES.some((phrase) => lowerAnswer.includes(phrase));

  if (isRefusal) {
    flags.push('refusal');
  }

  // Check for no_context: no chunks AND not a refusal
  if (chunksRetrieved === 0 && !isRefusal) {
    flags.push('no_context');
  }

  // Check for low_similarity: only when topScore < 0.60
  // If chunks_retrieved >= 1 AND topScore >= 0.60, do NOT flag
  if (topScore < 0.60) {
    flags.push('low_similarity');
  }

  return flags;
}
