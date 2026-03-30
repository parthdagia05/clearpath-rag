// api/_lib/init.ts
// Shared initialization for Vercel serverless functions.
// Only loads the vector store from embeddings.json.
// Embedding is done via HuggingFace API (no local model needed).

import path from 'path';
import { loadFromFile, getStoreSize } from '../../backend/services/vectorStore.service';

let initialized = false;

/**
 * Ensure the vector store is loaded.
 * Safe to call on every request — no-ops after the first invocation.
 */
export async function ensureInitialized(): Promise<void> {
  if (initialized) return;

  const embeddingsPath = path.join(process.cwd(), 'backend', 'data', 'embeddings.json');
  console.log('[Serverless Init] Loading vector store from', embeddingsPath);
  loadFromFile(embeddingsPath);
  console.log(`[Serverless Init] Loaded ${getStoreSize()} vectors`);

  initialized = true;
}
