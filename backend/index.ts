import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import path from 'path';
import chatRoutes from './routes/chat.routes';
import retrieveRoutes from './routes/retrieve.routes';
import { errorHandler } from './middleware/errorHandler';
import { initializeModel } from './services/embedding.service';
import { loadFromFile, getStoreSize } from './services/vectorStore.service';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  return res.json({ status: 'ok' });
});

// Routes
app.use('/api/chat', chatRoutes);
app.use('/api/retrieve', retrieveRoutes);

// Error handling (must be last)
app.use(errorHandler);

// ─── Startup ───────────────────────────────────
async function start() {
  // Step 1: Load vector store from pre-computed embeddings
  const embeddingsPath = path.resolve(__dirname, 'data/embeddings.json');
  console.log('[Startup] Loading vector store...');
  loadFromFile(embeddingsPath);
  console.log(`[Startup] Loaded ${getStoreSize()} vectors into memory`);

  // Step 2: Initialize embedding model ONCE (for query embedding)
  console.log('[Startup] Loading embedding model...');
  await initializeModel();
  console.log('[Startup] Embedding model initialized');

  // Step 3: Start HTTP server
  app.listen(PORT, () => {
    console.log(`[ClearPath] Server running on http://localhost:${PORT}`);
    console.log('[ClearPath] Ready to accept requests.');
  });
}

start().catch((err) => {
  console.error('[ClearPath] Fatal startup error:', err);
  process.exit(1);
});

export default app;
