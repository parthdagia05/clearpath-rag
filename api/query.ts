import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ensureInitialized } from './_lib/init';
import { retrieve } from '../backend/services/retrieval.service';
import { classify } from '../backend/services/router.service';
import { callGroq } from '../backend/services/llm.service';
import { evaluate } from '../backend/services/evaluator.service';
import type { QueryResponse, Source } from '../backend/types';

const SYSTEM_PROMPT =
  'You are a customer support assistant for ClearPath, a project management SaaS tool. ' +
  'Answer only using the provided documentation context. ' +
  'If information is not found in context, say so clearly.';

function generateConversationId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = 'conv_';
  for (let i = 0; i < 8; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

function trimToWords(text: string, maxWords: number): string {
  const words = text.split(/\s+/);
  if (words.length <= maxWords) return text;
  return words.slice(0, maxWords).join(' ');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await ensureInitialized();
  } catch (err) {
    console.error('[query] Initialization failed:', err);
    return res.status(503).json({ error: 'Service initializing, please retry in a few seconds.' });
  }

  const { question, conversation_id } = req.body;

  if (!question || typeof question !== 'string' || question.trim().length === 0) {
    return res.status(400).json({
      error: 'Missing or empty "question" field in request body.',
    });
  }

  const query = question.trim();
  const startTime = Date.now();

  try {
    // Step 1: Retrieve
    const retrievalResult = await retrieve(query);
    const retrievedChunks = retrievalResult.chunks;
    const topScore = retrievedChunks.length > 0 ? retrievedChunks[0].similarity_score : 0;
    const chunksRetrieved = retrievedChunks.length;

    // Step 2: Router
    const routerResult = classify(query);
    const { classification, model_used } = routerResult;

    // Step 3: Build prompts
    const top3Chunks = retrievedChunks.slice(0, 3);
    const contextText = top3Chunks.length > 0
      ? top3Chunks.map((c) => trimToWords(c.text, 250)).join('\n\n')
      : 'No relevant documentation found.';

    const userPrompt = `Context:\n${contextText}\n\nQuestion:\n${query}`;

    // Step 4: Call Groq
    const llmResult = await callGroq(model_used, SYSTEM_PROMPT, userPrompt);
    const { answer, tokens_input, tokens_output } = llmResult;

    // Step 5: Evaluator
    const evaluator_flags = evaluate(chunksRetrieved, topScore, answer);

    // Step 6: Sources
    const sources: Source[] = top3Chunks.map((c) => ({
      document: c.document_name + '.pdf',
      page: c.page_number,
      relevance_score: c.similarity_score,
    }));

    // Step 7: Conversation ID
    const convId = conversation_id || generateConversationId();

    const latency_ms = Date.now() - startTime;

    const response: QueryResponse = {
      answer,
      metadata: {
        model_used,
        classification,
        tokens: { input: tokens_input, output: tokens_output },
        latency_ms,
        chunks_retrieved: chunksRetrieved,
        evaluator_flags,
      },
      sources,
      conversation_id: convId,
    };

    return res.status(200).json(response);
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[query] Error: ${errorMessage}`);
    return res.status(500).json({ error: errorMessage });
  }
}
