const DEFAULT_MODEL = 'BAAI/bge-small-en-v1.5';
const E5_PREFIX_MODELS = ['intfloat/multilingual-e5', 'intfloat/e5-'];

function getModelId(): string {
  return process.env.EMBEDDING_MODEL || DEFAULT_MODEL;
}

function needsE5Prefix(model: string): boolean {
  return E5_PREFIX_MODELS.some((p) => model.toLowerCase().startsWith(p.toLowerCase()));
}

function applyPrefix(text: string, kind: 'query' | 'passage'): string {
  const model = getModelId();
  if (!needsE5Prefix(model)) return text;
  return kind === 'query' ? `query: ${text}` : `passage: ${text}`;
}

function getApiUrl(): string {
  return `https://router.huggingface.co/hf-inference/models/${getModelId()}`;
}

async function callHf(payload: unknown): Promise<unknown> {
  const hfToken = process.env.HF_API_KEY;
  if (!hfToken) {
    throw new Error('HF_API_KEY is not configured. Add it in your environment.');
  }

  const response = await fetch(getApiUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${hfToken}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`HuggingFace API error: ${response.status} — ${body}`);
  }
  return response.json();
}

function parseSingle(result: unknown): number[] {
  if (Array.isArray(result) && typeof result[0] === 'number') {
    return normalize(result as number[]);
  }
  if (Array.isArray(result) && Array.isArray(result[0])) {
    if (typeof (result as number[][])[0][0] === 'number') {
      return normalize(meanPool(result as number[][]));
    }
    if (Array.isArray((result as number[][][])[0][0])) {
      return normalize(meanPool((result as number[][][])[0]));
    }
  }
  throw new Error('Unexpected embedding response format from HuggingFace API');
}

export async function embed(
  text: string,
  kind: 'query' | 'passage' = 'query'
): Promise<number[]> {
  const result = await callHf({
    inputs: applyPrefix(text, kind),
    options: { wait_for_model: true },
  });
  return parseSingle(result);
}

export async function embedBatch(
  texts: string[],
  kind: 'query' | 'passage' = 'passage'
): Promise<number[][]> {
  if (texts.length === 0) return [];

  const prefixed = texts.map((t) => applyPrefix(t, kind));

  // try batched call first — works for sentence-transformers models on HF Inference
  try {
    const result = await callHf({
      inputs: prefixed,
      options: { wait_for_model: true },
    });
    if (Array.isArray(result) && result.length === prefixed.length) {
      return result.map((r) => parseSingle(r));
    }
  } catch {
    // fall through to sequential
  }

  // fallback: sequential with small concurrency
  const out: number[][] = new Array(texts.length);
  const CONCURRENCY = 4;
  for (let i = 0; i < texts.length; i += CONCURRENCY) {
    const slice = texts.slice(i, i + CONCURRENCY);
    const vecs = await Promise.all(slice.map((t) => embed(t, kind)));
    for (let j = 0; j < vecs.length; j++) out[i + j] = vecs[j];
  }
  return out;
}

function meanPool(tokenEmbeddings: number[][]): number[] {
  const dim = tokenEmbeddings[0].length;
  const pooled = new Array(dim).fill(0);
  for (const token of tokenEmbeddings) {
    for (let i = 0; i < dim; i++) pooled[i] += token[i];
  }
  for (let i = 0; i < dim; i++) pooled[i] /= tokenEmbeddings.length;
  return pooled;
}

function normalize(vec: number[]): number[] {
  let mag = 0;
  for (const v of vec) mag += v * v;
  mag = Math.sqrt(mag);
  if (mag === 0) return vec;
  return vec.map((v) => v / mag);
}
