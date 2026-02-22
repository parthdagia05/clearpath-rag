import { Router, Request, Response } from 'express';

const router = Router();

/**
 * POST /api/chat
 * Stub — returns a placeholder response.
 * RAG logic will be implemented in a later phase.
 */
router.post('/', (_req: Request, res: Response) => {
  // TODO: Integrate router.service → embedding → vectorStore → llm
  res.json({
    reply: 'ClearPath support is not yet implemented.',
    debug: {
      model: 'none',
      tokensUsed: 0,
      latencyMs: 0,
      evaluatorFlag: 'N/A',
    },
  });
});

export default router;
