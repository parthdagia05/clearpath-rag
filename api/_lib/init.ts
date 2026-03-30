// api/_lib/init.ts
// Shared initialization for Vercel serverless functions.
// Uses module-level caching so the embedding model and vector store
// persist across warm invocations of the same function instance.

import path from 'path';
import { initializeModel } from '../../backend/services/embedding.service';
import { loadFromFile, getStoreSize } from '../../backend/services/vectorStore.service';

let initialized = false;

/**
 * Ensure the vector store and embedding model are loaded.
 * Safe to call on every request — no-ops after the first invocation.
 */
export async function ensureInitialized(): Promise<void> {
  if (initialized) return;

  // Load pre-computed embeddings
  const embeddingsPath = path.join(process.cwd(), 'backend', 'data', 'embeddings.json');
  console.log('[Serverless Init] Loading vector store from', embeddingsPath);
  loadFromFile(embeddingsPath);
  console.log(`[Serverless Init] Loaded ${getStoreSize()} vectors`);

  // Initialize embedding model (downloads on first cold start, cached in /tmp after)
  console.log('[Serverless Init] Loading embedding model...');
  await initializeModel();
  console.log('[Serverless Init] Embedding model ready');

  initialized = true;
}
