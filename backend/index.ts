import dotenv from 'dotenv';
dotenv.config();

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';

import uploadHandler from '../api/upload';
import queryHandler from '../api/query';
import retrieveHandler from '../api/retrieve';
import documentsHandler from '../api/documents';
import healthHandler from '../api/health';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());

// JSON body parsing — but NOT for /api/upload (which expects raw PDF bytes)
app.use((req, res, next) => {
  if (req.path === '/api/upload') return next();
  return express.json({ limit: '5mb' })(req, res, next);
});

function adapt(handler: any) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await handler(req as any, res as any);
    } catch (err) {
      next(err);
    }
  };
}

app.get('/api/health', adapt(healthHandler));
app.post('/api/upload', adapt(uploadHandler));
app.post('/api/query', adapt(queryHandler));
app.post('/api/retrieve', adapt(retrieveHandler));
app.get('/api/documents', adapt(documentsHandler));
app.delete('/api/documents', adapt(documentsHandler));

app.use(
  (err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error(`[error] ${err.message}`);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || 'Internal Server Error' });
    }
  }
);

app.listen(PORT, () => {
  console.log(`[clearpath] dev server running at http://localhost:${PORT}`);
  console.log('[clearpath] PDF chat ready. Upload a PDF via POST /api/upload.');
  if (!process.env.HF_API_KEY) {
    console.warn('[clearpath] WARNING: HF_API_KEY is not set. Embeddings will fail.');
  }
  if (!process.env.GROQ_API_KEY) {
    console.warn('[clearpath] WARNING: GROQ_API_KEY is not set. LLM calls will fail.');
  }
});

export default app;
