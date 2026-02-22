// services/vectorStore.service.ts
// In-memory vector store with JSON persistence
// No Pinecone, no Weaviate, no external vector DB

import fs from 'fs';
import path from 'path';
import { Chunk, VectorSearchResult } from '../types';
import { cosineSimilarity } from '../utils/similarity';

// ───────────────────────────────────────────────
// In-memory store
// ───────────────────────────────────────────────

let store: Chunk[] = [];

/**
 * Add documents (chunks with embeddings) to the in-memory store.
 */
export function addDocuments(chunks: Chunk[]): void {
  // Validate all chunks have embeddings
  for (const chunk of chunks) {
    if (!chunk.embedding || chunk.embedding.length === 0) {
      throw new Error(
        `[VectorStore] Chunk ${chunk.chunk_id} is missing an embedding.`
      );
    }
  }

  store.push(...chunks);
  console.log(`[VectorStore] Added ${chunks.length} chunks. Total: ${store.length}`);
}

/**
 * Search the store for the top-K most similar chunks to a query embedding.
 * Uses manual cosine similarity from utils/similarity.ts.
 */
export function search(
  queryEmbedding: number[],
  topK: number = 5
): VectorSearchResult[] {
  if (store.length === 0) {
    console.warn('[VectorStore] Store is empty — no results.');
    return [];
  }

  const scored = store.map((chunk) => ({
    id: chunk.chunk_id,
    content: chunk.text,
    score: cosineSimilarity(queryEmbedding, chunk.embedding!),
    document_name: chunk.document_name,
    page_number: chunk.page_number,
  }));

  // Sort by score descending, return top-K
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}

/**
 * Get the current number of vectors in the store.
 */
export function getStoreSize(): number {
  return store.length;
}

/**
 * Clear all vectors from the store.
 */
export function clearStore(): void {
  store = [];
}

/**
 * Persist the in-memory store to a JSON file.
 */
export function persistToFile(filePath: string): void {
  const absolutePath = path.resolve(filePath);
  const dir = path.dirname(absolutePath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(absolutePath, JSON.stringify(store, null, 2), 'utf-8');
  console.log(`[VectorStore] Persisted ${store.length} vectors to ${absolutePath}`);
}

/**
 * Load vectors from a JSON file into the in-memory store.
 */
export function loadFromFile(filePath: string): void {
  const absolutePath = path.resolve(filePath);

  if (!fs.existsSync(absolutePath)) {
    console.warn(`[VectorStore] File not found: ${absolutePath}. Starting with empty store.`);
    return;
  }

  const data = fs.readFileSync(absolutePath, 'utf-8');
  const chunks: Chunk[] = JSON.parse(data);

  // Validate loaded data
  const withEmbeddings = chunks.filter(
    (c) => c.embedding && c.embedding.length > 0
  );

  store = withEmbeddings;
  console.log(`[VectorStore] Loaded ${store.length} vectors from ${absolutePath}`);

  if (store.length > 0) {
    console.log(`[VectorStore] Embedding dimension: ${store[0].embedding!.length}`);
  }
}
