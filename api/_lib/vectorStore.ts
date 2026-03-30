import fs from 'fs';
import { Chunk, VectorSearchResult } from './types';
import { cosineSimilarity } from './similarity';

let store: Chunk[] = [];

export function search(queryEmbedding: number[], topK: number = 5): VectorSearchResult[] {
  if (store.length === 0) return [];

  const scored = store.map((chunk) => ({
    id: chunk.chunk_id,
    content: chunk.text,
    score: cosineSimilarity(queryEmbedding, chunk.embedding!),
    document_name: chunk.document_name,
    page_number: chunk.page_number,
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}

export function getStoreSize(): number {
  return store.length;
}

export function loadFromFile(filePath: string): void {
  if (!fs.existsSync(filePath)) {
    console.warn(`[VectorStore] File not found: ${filePath}`);
    return;
  }

  const data = fs.readFileSync(filePath, 'utf-8');
  const chunks: Chunk[] = JSON.parse(data);
  store = chunks.filter((c) => c.embedding && c.embedding.length > 0);
  console.log(`[VectorStore] Loaded ${store.length} vectors`);
}
