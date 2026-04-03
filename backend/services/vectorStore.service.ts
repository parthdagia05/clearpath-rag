import fs from 'fs';
import path from 'path';
import { Chunk, VectorSearchResult } from '../types';
import { cosineSimilarity } from '../utils/similarity';

let store: Chunk[] = [];

export function addDocuments(chunks: Chunk[]): void {
  for (const chunk of chunks) {
    if (!chunk.embedding || chunk.embedding.length === 0) {
      throw new Error(
        `[vectorStore] chunk ${chunk.chunk_id} is missing an embedding.`
      );
    }
  }

  store.push(...chunks);
  console.log(`[vectorStore] added ${chunks.length} chunks. total: ${store.length}`);
}

export function search(
  queryEmbedding: number[],
  topK: number = 5
): VectorSearchResult[] {
  if (store.length === 0) {
    console.warn('[vectorStore] store is empty, no results.');
    return [];
  }

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

export function clearStore(): void {
  store = [];
}

export function persistToFile(filePath: string): void {
  const absolutePath = path.resolve(filePath);
  const dir = path.dirname(absolutePath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(absolutePath, JSON.stringify(store, null, 2), 'utf-8');
  console.log(`[vectorStore] persisted ${store.length} vectors to ${absolutePath}`);
}

export function loadFromFile(filePath: string): void {
  const absolutePath = path.resolve(filePath);

  if (!fs.existsSync(absolutePath)) {
    console.warn(`[vectorStore] file not found: ${absolutePath}. starting with empty store.`);
    return;
  }

  const data = fs.readFileSync(absolutePath, 'utf-8');
  const chunks: Chunk[] = JSON.parse(data);

  const withEmbeddings = chunks.filter(
    (c) => c.embedding && c.embedding.length > 0
  );

  store = withEmbeddings;
  console.log(`[vectorStore] loaded ${store.length} vectors from ${absolutePath}`);

  if (store.length > 0) {
    console.log(`[vectorStore] embedding dimension: ${store[0].embedding!.length}`);
  }
}
