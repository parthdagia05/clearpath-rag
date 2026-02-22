// services/retrieval.service.ts
// Query embedding → Vector search → Threshold filter
// No LLM. No router. Pure retrieval.
//
// IMPORTANT: Model and vector store are initialized in index.ts at startup.
// This service only handles per-request retrieval logic.

import { embed } from './embedding.service';
import { search, getStoreSize } from './vectorStore.service';

const SIMILARITY_THRESHOLD = 0.60;
const TOP_K = 5;
const TIMEOUT_MS = 30_000;

export interface RetrievalChunk {
  chunk_id: string;
  document_name: string;
  page_number: number | null;
  text: string;
  similarity_score: number;
}

export interface RetrievalResult {
  chunks: RetrievalChunk[];
  error?: string;
}

/**
 * Retrieve relevant chunks for a user query.
 *
 * 1. Embed the query using BGE-small (model already loaded at startup)
 * 2. Search vector store (top-K)
 * 3. Filter by similarity threshold (0.65)
 * 4. Return matching chunks with scores
 *
 * Includes a 30-second timeout safeguard.
 */
export async function retrieve(query: string): Promise<RetrievalResult> {
  // Timeout wrapper
  const timeoutPromise = new Promise<RetrievalResult>((_, reject) => {
    setTimeout(() => reject(new Error('Retrieval timeout')), TIMEOUT_MS);
  });

  const retrievalPromise = doRetrieve(query);

  return Promise.race([retrievalPromise, timeoutPromise]);
}

async function doRetrieve(query: string): Promise<RetrievalResult> {
  const startTime = Date.now();

  console.log(`[Retrieval] Step 1: Embedding query "${query.substring(0, 60)}..."`);

  // Step 1: Embed the query (model already loaded—no init here)
  const queryEmbedding = await embed(query);

  console.log('[Retrieval] Step 2: Searching vector store');

  // Step 2: Search vector store (synchronous — cosine similarity)
  const results = search(queryEmbedding, TOP_K);

  // Step 3: Filter by threshold
  const filtered = results
    .filter((r) => r.score >= SIMILARITY_THRESHOLD)
    .map((r) => ({
      chunk_id: r.id,
      document_name: r.document_name,
      page_number: r.page_number,
      text: r.content,
      similarity_score: Math.round(r.score * 10000) / 10000,
    }));

  const elapsed = Date.now() - startTime;
  const topScore = results.length > 0 ? results[0].score.toFixed(4) : 'N/A';

  console.log(`[Retrieval] Step 3: Sending response`);
  console.log(`[Retrieval]   Top score: ${topScore} | Returned: ${filtered.length}/${results.length} chunks | ${elapsed}ms`);

  return { chunks: filtered };
}
