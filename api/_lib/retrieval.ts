import { embed } from './embedding';
import { search } from './vectorStore';

const SIMILARITY_THRESHOLD = 0.60;
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
}

export async function retrieve(query: string): Promise<RetrievalResult> {
  const queryEmbedding = await embed(query);
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

  return { chunks: filtered };
}
