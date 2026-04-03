// api/_lib/embedding.ts
// Lightweight embedding service for Vercel serverless.
// Uses HuggingFace Inference API (free with token) instead of
// @xenova/transformers which is too heavy for serverless.
// Same model (BGE-small-en-v1.5) so embeddings are compatible with pre-computed vectors.

const MODEL_ID = 'BAAI/bge-small-en-v1.5';
const API_URL = `https://router.huggingface.co/hf-inference/models/${MODEL_ID}`;

/**
 * Embed a single text string via HuggingFace Inference API.
 * Returns a normalized 384-dim vector compatible with the pre-computed embeddings.
 */
export async function embed(text: string): Promise<number[]> {
  const hfToken = process.env.HF_API_KEY;
  if (!hfToken) {
    throw new Error('HF_API_KEY is not configured. Add it in Vercel environment variables.');
  }

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${hfToken}`,
    },
    body: JSON.stringify({
      inputs: text,
      options: { wait_for_model: true },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`HuggingFace API error: ${response.status} — ${body}`);
  }

  const result = await response.json();

  // HF returns a flat number[] (384-dim) for sentence-transformers models
  if (Array.isArray(result) && typeof result[0] === 'number') {
    return normalize(result as number[]);
  }

  // Fallback: number[][] (tokens × dims) — apply mean pooling
  if (Array.isArray(result) && Array.isArray(result[0])) {
    if (typeof result[0][0] === 'number') {
      return normalize(meanPool(result as number[][]));
    }
    if (Array.isArray(result[0][0])) {
      return normalize(meanPool(result[0] as number[][]));
    }
  }

  throw new Error('Unexpected embedding response format from HuggingFace API');
}

function meanPool(tokenEmbeddings: number[][]): number[] {
  const dim = tokenEmbeddings[0].length;
  const pooled = new Array(dim).fill(0);
  for (const token of tokenEmbeddings) {
    for (let i = 0; i < dim; i++) {
      pooled[i] += token[i];
    }
  }
  for (let i = 0; i < dim; i++) {
    pooled[i] /= tokenEmbeddings.length;
  }
  return pooled;
}

function normalize(vec: number[]): number[] {
  let mag = 0;
  for (const v of vec) mag += v * v;
  mag = Math.sqrt(mag);
  if (mag === 0) return vec;
  return vec.map((v) => v / mag);
}
