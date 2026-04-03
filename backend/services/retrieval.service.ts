import { embed } from './embedding.service';
import { search } from './vectorStore.service';

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

export async function retrieve(query: string): Promise<RetrievalResult> {
  const timeoutPromise = new Promise<RetrievalResult>((_, reject) => {
    setTimeout(() => reject(new Error('Retrieval timeout')), TIMEOUT_MS);
  });

  const retrievalPromise = doRetrieve(query);

  return Promise.race([retrievalPromise, timeoutPromise]);
}

async function doRetrieve(query: string): Promise<RetrievalResult> {
  const startTime = Date.now();

  console.log(`[retrieval] embedding query "${query.substring(0, 60)}..."`);
  const queryEmbedding = await embed(query);

  console.log('[retrieval] searching vector store');
  const results = search(queryEmbedding, TOP_K);

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

  console.log(`[retrieval] top score: ${topScore} | returned: ${filtered.length}/${results.length} chunks | ${elapsed}ms`);

  return { chunks: filtered };
}
