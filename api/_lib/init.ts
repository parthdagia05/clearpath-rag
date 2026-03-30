import path from 'path';
import { loadFromFile, getStoreSize } from './vectorStore';

let initialized = false;

export async function ensureInitialized(): Promise<void> {
  if (initialized) return;

  const embeddingsPath = path.join(process.cwd(), 'backend', 'data', 'embeddings.json');
  console.log('[Init] Loading vector store from', embeddingsPath);
  loadFromFile(embeddingsPath);
  console.log(`[Init] Loaded ${getStoreSize()} vectors`);

  initialized = true;
}
