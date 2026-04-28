import { embed } from './embedding';
import { getDocument } from './documentStore';
import { cosineSimilarity } from './similarity';

const SIMILARITY_THRESHOLD = 0.55;
const TOP_K = 5;

export interface RetrievalChunk {
  chunk_id: string;
  document_name: string;
  page_number: number | null;
  text: string;
  similarity_score: number;
}

export interface RetrievalResult {
  chunks: RetrievalChunk[];
  raw_top_score: number;
}

export async function retrieve(
  query: string,
  documentId: string
): Promise<RetrievalResult> {
  const doc = getDocument(documentId);
  if (!doc) {
    throw new Error('DOCUMENT_NOT_FOUND');
  }

  const queryEmbedding = await embed(query, 'query');

  const scored = doc.chunks
    .filter((c) => c.embedding && c.embedding.length > 0)
    .map((c) => ({
      chunk_id: c.chunk_id,
      document_name: c.document_name,
      page_number: c.page_number,
      text: c.text,
      similarity_score: cosineSimilarity(queryEmbedding, c.embedding!),
    }));

  scored.sort((a, b) => b.similarity_score - a.similarity_score);
  const topK = scored.slice(0, TOP_K);
  const rawTopScore = topK.length > 0 ? topK[0].similarity_score : 0;

  const filtered = topK
    .filter((r) => r.similarity_score >= SIMILARITY_THRESHOLD)
    .map((r) => ({
      ...r,
      similarity_score: Math.round(r.similarity_score * 10000) / 10000,
    }));

  return {
    chunks: filtered,
    raw_top_score: Math.round(rawTopScore * 10000) / 10000,
  };
}
