// routes/retrieve.routes.ts
// Temporary test route for retrieval pipeline
// POST /api/retrieve { "query": "..." } → { chunks: [...] }
// No LLM. No router integration.

import { Router, Request, Response } from 'express';
import { retrieve } from '../services/retrieval.service';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  const { query } = req.body;

  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    return res.status(400).json({
      error: 'Missing or empty "query" field in request body.',
    });
  }

  try {
    console.log('[Route /api/retrieve] Received query, starting retrieval...');
    const result = await retrieve(query.trim());
    console.log('[Route /api/retrieve] Retrieval complete, sending response.');
    return res.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[Route /api/retrieve] Error:', message);

    if (message === 'Retrieval timeout') {
      return res.status(504).json({ error: 'Retrieval timeout' });
    }

    return res.status(500).json({ error: 'Retrieval failed.' });
  }
});

export default router;
