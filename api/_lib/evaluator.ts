export const REFUSAL_OUT_OF_PDF =
  'I cannot find that information in the provided document.';
export const REFUSAL_OUT_OF_SCOPE =
  'I can only answer questions about the uploaded document.';

const REFUSAL_MARKERS = [
  'cannot find that information',
  'can only answer questions about the uploaded document',
  'not found in the provided document',
  "i don't know",
  'do not have that information',
  'not mentioned in the document',
];

export function isRefusal(answer: string): boolean {
  const a = answer.toLowerCase();
  return REFUSAL_MARKERS.some((m) => a.includes(m));
}

export function evaluate(
  chunksRetrieved: number,
  rawTopScore: number,
  answer: string
): { flags: string[]; refused: boolean } {
  const flags: string[] = [];
  const refused = isRefusal(answer);

  if (refused) flags.push('refusal');
  if (chunksRetrieved === 0 && !refused) flags.push('no_context');
  if (rawTopScore < 0.55) flags.push('low_similarity');
  if (!refused && chunksRetrieved > 0 && rawTopScore < 0.45) {
    flags.push('possibly_ungrounded');
  }

  return { flags, refused };
}
