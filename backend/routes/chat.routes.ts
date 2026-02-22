// routes/chat.routes.ts
// POST /api/chat — retrieval-only (no LLM yet)
// Calls retrieval service, returns chunks + debug info

import { Router, Request, Response } from 'express';
import { retrieve } from '../services/retrieval.service';

const router = Router();

/**
 * POST /api/chat
 * Input:  { message: string }
 * Output: { reply, retrievedChunksCount, topScore, debug }
 *
 * Calls the retrieval pipeline (embed → search → threshold filter).
 * Does NOT call Groq/LLM — returns a placeholder reply.
 */
router.post('/', async (req: Request, res: Response) => {
  const { message } = req.body;

  // ── Validate ────────────────────────────────────
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({
      error: 'Missing or empty "message" field in request body.',
    });
  }

  const query = message.trim();
  const startTime = Date.now();

  try {
    console.log(`[Chat] Query: "${query}"`);

    // ── Retrieval ───────────────────────────────────
    const result = await retrieve(query);
    const latencyMs = Date.now() - startTime;

    const topScore = result.chunks.length > 0
      ? result.chunks[0].similarity_score
      : 0;

    // ── Logging ─────────────────────────────────────
    console.log(`[Chat] Top similarity score: ${topScore}`);
    console.log(`[Chat] Chunks returned: ${result.chunks.length}`);
    console.log(`[Chat] Retrieval latency: ${latencyMs}ms`);

    // ── Response ────────────────────────────────────
    return res.json({
      reply: 'LLM not integrated yet.',
      retrievedChunksCount: result.chunks.length,
      topScore,
      debug: {
        model: 'none',
        tokensUsed: 0,
        latencyMs,
        evaluatorFlag: 'N/A',
      },
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[Chat] Error during retrieval: ${errorMessage}`);

    if (errorMessage === 'Retrieval timeout') {
      return res.status(504).json({ error: 'Retrieval timeout' });
    }

    return res.status(500).json({ error: 'Chat retrieval failed.' });
  }
});

export default router;
