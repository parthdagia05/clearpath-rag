import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import path from 'path';
import queryRoutes from './routes/query.routes';
import retrieveRoutes from './routes/retrieve.routes';
import { errorHandler } from './middleware/errorHandler';
import { initializeModel } from './services/embedding.service';
import { loadFromFile, getStoreSize } from './services/vectorStore.service';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  return res.json({ status: 'ok' });
});

app.use('/query', queryRoutes);
app.use('/api/retrieve', retrieveRoutes);

app.use(errorHandler);

async function start() {
  const embeddingsPath = path.resolve(__dirname, 'data/embeddings.json');
  console.log('[startup] loading vector store...');
  loadFromFile(embeddingsPath);
  console.log(`[startup] loaded ${getStoreSize()} vectors into memory`);

  console.log('[startup] loading embedding model...');
  await initializeModel();
  console.log('[startup] embedding model initialized');

  app.listen(PORT, () => {
    console.log(`[clearpath] server running on http://localhost:${PORT}`);
    console.log('[clearpath] ready to accept requests.');
  });
}

start().catch((err) => {
  console.error('[clearpath] fatal startup error:', err);
  process.exit(1);
});

export default app;
