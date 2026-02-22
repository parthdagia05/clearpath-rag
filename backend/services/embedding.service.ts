// services/embedding.service.ts
// Local embedding generation using @xenova/transformers (BGE-small)
// No external embedding APIs — singleton pattern for model caching

import { pipeline } from '@xenova/transformers';

// ───────────────────────────────────────────────
// Singleton model instance
// ───────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let embeddingPipeline: any = null;
let modelDimension: number = 0;

/**
 * Initialize the embedding model (singleton).
 * Loads BGE-small-en-v1.5 via @xenova/transformers.
 * Call once at startup; subsequent calls are no-ops.
 */
export async function initializeModel(): Promise<void> {
  if (embeddingPipeline) {
    console.log('[Embedding] Model already loaded — skipping initialization.');
    return;
  }

  console.log('[Embedding] Loading model: Xenova/bge-small-en-v1.5...');
  const startTime = Date.now();

  embeddingPipeline = await pipeline(
    'feature-extraction',
    'Xenova/bge-small-en-v1.5'
  );

  // Probe dimension with a test embedding
  const testResult = await embeddingPipeline('test', {
    pooling: 'mean',
    normalize: true,
  });
  modelDimension = Array.from(testResult.data as Float32Array).length;

  const elapsed = Date.now() - startTime;
  console.log(`[Embedding] Model loaded in ${elapsed}ms`);
  console.log(`[Embedding] Embedding dimension: ${modelDimension}`);
}

/**
 * Get the embedding dimension of the loaded model.
 */
export function getDimension(): number {
  return modelDimension;
}

/**
 * Generate an embedding for a single text string.
 * Returns a number[] vector.
 */
export async function embed(text: string): Promise<number[]> {
  if (!embeddingPipeline) {
    throw new Error('[Embedding] Model not initialized. Call initializeModel() first.');
  }

  const result = await embeddingPipeline(text, {
    pooling: 'mean',
    normalize: true,
  });

  return Array.from(result.data as Float32Array);
}

/**
 * Generate embeddings for a batch of texts.
 * Processes sequentially to avoid OOM on large batches.
 * Returns number[][] (one vector per input text).
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (!embeddingPipeline) {
    throw new Error('[Embedding] Model not initialized. Call initializeModel() first.');
  }

  const embeddings: number[][] = [];

  for (let i = 0; i < texts.length; i++) {
    const result = await embeddingPipeline(texts[i], {
      pooling: 'mean',
      normalize: true,
    });
    embeddings.push(Array.from(result.data as Float32Array));

    // Progress logging every 50 chunks
    if ((i + 1) % 50 === 0 || i === texts.length - 1) {
      console.log(`[Embedding]   Embedded ${i + 1}/${texts.length} chunks`);
    }
  }

  return embeddings;
}
