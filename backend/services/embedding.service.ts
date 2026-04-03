import { pipeline } from '@xenova/transformers';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let embeddingPipeline: any = null;
let modelDimension: number = 0;

export async function initializeModel(): Promise<void> {
  if (embeddingPipeline) {
    console.log('[embedding] model already loaded, skipping initialization.');
    return;
  }

  console.log('[embedding] loading model: Xenova/bge-small-en-v1.5...');
  const startTime = Date.now();

  embeddingPipeline = await pipeline(
    'feature-extraction',
    'Xenova/bge-small-en-v1.5'
  );

  const testResult = await embeddingPipeline('test', {
    pooling: 'mean',
    normalize: true,
  });
  modelDimension = Array.from(testResult.data as Float32Array).length;

  const elapsed = Date.now() - startTime;
  console.log(`[embedding] model loaded in ${elapsed}ms`);
  console.log(`[embedding] embedding dimension: ${modelDimension}`);
}

export function getDimension(): number {
  return modelDimension;
}

export async function embed(text: string): Promise<number[]> {
  if (!embeddingPipeline) {
    throw new Error('[embedding] model not initialized. call initializeModel() first.');
  }

  const result = await embeddingPipeline(text, {
    pooling: 'mean',
    normalize: true,
  });

  return Array.from(result.data as Float32Array);
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (!embeddingPipeline) {
    throw new Error('[embedding] model not initialized. call initializeModel() first.');
  }

  const embeddings: number[][] = [];

  for (let i = 0; i < texts.length; i++) {
    const result = await embeddingPipeline(texts[i], {
      pooling: 'mean',
      normalize: true,
    });
    embeddings.push(Array.from(result.data as Float32Array));

    if ((i + 1) % 50 === 0 || i === texts.length - 1) {
      console.log(`[embedding] embedded ${i + 1}/${texts.length} chunks`);
    }
  }

  return embeddings;
}
