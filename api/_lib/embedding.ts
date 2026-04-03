const MODEL_ID = 'BAAI/bge-small-en-v1.5';
const API_URL = `https://router.huggingface.co/hf-inference/models/${MODEL_ID}`;

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

  // flat number[] (384-dim) for sentence-transformers models
  if (Array.isArray(result) && typeof result[0] === 'number') {
    return normalize(result as number[]);
  }

  // fallback: number[][] (tokens x dims), apply mean pooling
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
