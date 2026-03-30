const REFUSAL_PHRASES = [
  'not found', 'cannot find', 'do not have', 'not mentioned', "i don't know",
];

export function evaluate(chunksRetrieved: number, topScore: number, answer: string): string[] {
  const flags: string[] = [];
  const lowerAnswer = answer.toLowerCase();
  const isRefusal = REFUSAL_PHRASES.some((phrase) => lowerAnswer.includes(phrase));

  if (isRefusal) flags.push('refusal');
  if (chunksRetrieved === 0 && !isRefusal) flags.push('no_context');
  if (topScore < 0.60) flags.push('low_similarity');

  return flags;
}
