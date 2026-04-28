import type { VercelRequest, VercelResponse } from '@vercel/node';
import { retrieve } from './_lib/retrieval';
import { classify } from './_lib/router';
import { callGroq } from './_lib/llm';
import {
  evaluate,
  REFUSAL_OUT_OF_PDF,
  REFUSAL_OUT_OF_SCOPE,
} from './_lib/evaluator';
import { hasDocument } from './_lib/documentStore';
import {
  appendTurn,
  generateConversationId,
  getHistory,
} from './_lib/conversationStore';
import type { QueryResponse, Source } from './_lib/types';

const SYSTEM_PROMPT = [
  'You are a strict PDF question-answering assistant.',
  'You ONLY answer using the EXCERPTS provided in the user message below.',
  '',
  'STRICT RULES:',
  `1. If the answer is not present in the excerpts, reply EXACTLY: "${REFUSAL_OUT_OF_PDF}"`,
  '   Do not guess. Do not use outside / world knowledge. Do not infer beyond what is written.',
  `2. If the user asks something clearly unrelated to the document (e.g. coding help, jokes,`,
  `   real-time data, general knowledge), reply EXACTLY: "${REFUSAL_OUT_OF_SCOPE}"`,
  '3. After every factual statement, cite the page in square brackets: [Page N].',
  '   If a page number is unavailable for an excerpt, use [Document]. Multiple pages: [Page 2, 5].',
  '4. Respond in the SAME language as the user\'s latest question.',
  '5. Use prior conversation turns to interpret follow-up questions, but ground every',
  '   factual claim in the supplied excerpts only.',
  '6. Be concise. Do not invent section titles or page numbers that are not in the excerpts.',
].join('\n');

function trimToWords(text: string, maxWords: number): string {
  const words = text.split(/\s+/);
  if (words.length <= maxWords) return text;
  return words.slice(0, maxWords).join(' ') + '…';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { question, conversation_id, document_id } = req.body || {};

  if (!document_id || typeof document_id !== 'string') {
    return res.status(400).json({
      error: 'Missing "document_id". Upload a PDF to /api/upload first.',
    });
  }

  if (!question || typeof question !== 'string' || question.trim().length === 0) {
    return res.status(400).json({ error: 'Missing or empty "question" field.' });
  }

  if (!hasDocument(document_id)) {
    return res.status(404).json({
      error:
        'document_id not found. The document may have expired (1h TTL) or the server restarted. Re-upload the PDF.',
      code: 'DOCUMENT_NOT_FOUND',
    });
  }

  const query = question.trim();
  const startedAt = Date.now();

  try {
    const retrieval = await retrieve(query, document_id);
    const retrievedChunks = retrieval.chunks;
    const chunksRetrieved = retrievedChunks.length;
    const rawTopScore = retrieval.raw_top_score;

    const { classification, model_used } = classify(query);
    const top3 = retrievedChunks.slice(0, 3);

    const convId = conversation_id || generateConversationId();
    const history = getHistory(convId, document_id);

    let answer: string;
    let tokens_input = 0;
    let tokens_output = 0;
    let llmCalled = false;

    if (chunksRetrieved === 0) {
      answer = REFUSAL_OUT_OF_PDF;
    } else {
      const contextText = top3
        .map((c, i) => {
          const pageTag =
            c.page_number != null ? `Page ${c.page_number}` : 'Document';
          return `[Excerpt ${i + 1} | ${pageTag} | filename: ${c.document_name}]\n${trimToWords(c.text, 280)}`;
        })
        .join('\n\n');

      const userPrompt = [
        `EXCERPTS FROM THE PDF (the only knowledge you may use):`,
        '',
        contextText,
        '',
        `USER QUESTION: ${query}`,
      ].join('\n');

      const llm = await callGroq(model_used, SYSTEM_PROMPT, history, userPrompt);
      answer = llm.answer.trim();
      tokens_input = llm.tokens_input;
      tokens_output = llm.tokens_output;
      llmCalled = true;
    }

    const { flags, refused } = evaluate(chunksRetrieved, rawTopScore, answer);

    const sources: Source[] = top3.map((c) => ({
      document: c.document_name,
      page: c.page_number,
      relevance_score: c.similarity_score,
      excerpt: trimToWords(c.text, 60),
    }));

    appendTurn(convId, document_id, { role: 'user', content: query });
    appendTurn(convId, document_id, { role: 'assistant', content: answer });

    const latency_ms = Date.now() - startedAt;

    console.log(
      JSON.stringify({
        event: 'query',
        document_id,
        conversation_id: convId,
        query: query.slice(0, 200),
        classification,
        model_used: llmCalled ? model_used : 'none',
        chunks_retrieved: chunksRetrieved,
        raw_top_score: rawTopScore,
        tokens_input,
        tokens_output,
        latency_ms,
        flags,
        refused,
      })
    );

    const body: QueryResponse = {
      answer,
      metadata: {
        model_used: llmCalled ? model_used : 'none',
        classification,
        tokens: { input: tokens_input, output: tokens_output },
        latency_ms,
        chunks_retrieved: chunksRetrieved,
        evaluator_flags: flags,
        refused,
      },
      sources: refused && chunksRetrieved === 0 ? [] : sources,
      conversation_id: convId,
      document_id,
    };

    return res.status(200).json(body);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[query] error:', msg);
    if (msg === 'DOCUMENT_NOT_FOUND') {
      return res.status(404).json({
        error: 'document_id not found. Re-upload the PDF.',
        code: 'DOCUMENT_NOT_FOUND',
      });
    }
    return res.status(500).json({ error: msg });
  }
}
