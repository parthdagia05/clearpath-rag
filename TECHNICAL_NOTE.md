# Technical Note — Task 3: PDF-Constrained Conversational Agent

## Architecture

```
┌─────────────┐   PDF bytes    ┌──────────────────────────────────┐
│  React UI   │ ─────────────► │  POST /api/upload                │
│  (Vite)     │                │  ┌──────────────────────────┐    │
└──────┬──────┘                │  │ pdfjs-dist  → extract    │    │
       │                       │  │ heading-aware chunker    │    │
       │ document_id           │  │ HF Inference API (embed) │    │
       │ conversation_id       │  │ documentStore.add(...)   │    │
       │                       │  └──────────────────────────┘    │
       ▼                       └──────────────────────────────────┘
┌──────────────────────────────────────────────────────────────────┐
│  POST /api/query   {document_id, question, conversation_id?}    │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │ 1. document lookup (in-memory store, 1h TTL)             │    │
│  │ 2. embed query (HF API, e5 prefix if multilingual)       │    │
│  │ 3. cosine top-K=5, threshold=0.55                        │    │
│  │ 4. classify: simple / complex (rule-based, no LLM)       │    │
│  │ 5. fetch conversation history (last 8 turns)             │    │
│  │ 6. strict system prompt + excerpts + history → Groq      │    │
│  │ 7. evaluate refusal / flags                              │    │
│  │ 8. append turn to conversationStore                      │    │
│  └──────────────────────────────────────────────────────────┘    │
│         ↓                                                        │
│  { answer, metadata{refused, flags, ...}, sources[], ids }       │
└──────────────────────────────────────────────────────────────────┘
```

## Key design decisions

### 1. Per-PDF in-memory store (not a vector DB)
A `Map<document_id, StoredDocument>` lives in the function/process. PDFs are
ephemeral (1 hour TTL) and bound to a single user session. No external DB
dependency for a take-home demo.

**Trade-off:** on Vercel cold start the map is empty → client receives a
`DOCUMENT_NOT_FOUND` error and re-uploads. Acceptable because uploads are cheap
(seconds) and avoids the cost / complexity of Vercel KV, Pinecone, etc.
For production with many users, swap `documentStore.ts` for an external store
(Supabase pgvector, Pinecone, Qdrant) — the rest of the pipeline is unchanged.

### 2. Strict grounding via system prompt + retrieval
- System prompt explicitly bounds "the only knowledge you may use" to the supplied
  excerpts and mandates a fixed refusal sentence.
- Temperature is `0.1` (almost deterministic).
- Excerpts are tagged `[Excerpt N | Page M | filename: …]` so the model can produce
  inline `[Page N]` citations and never invent page numbers.
- If retrieval returns 0 chunks above the similarity threshold, the LLM is **not**
  called — the canonical refusal is returned directly. Saves tokens and prevents
  any chance of hallucination.

### 3. Conversation memory (last 8 turns)
`conversationStore.ts` keeps a rolling window per `conversation_id`, scoped to a
`document_id`. Sent as `messages: [...]` to Groq alongside the system prompt and
the current excerpts. Memory is dropped if the user uploads a new PDF.

### 4. Rule-based router
Kept from the previous version of the codebase: a deterministic word-count + keyword
classifier picks `llama-3.1-8b-instant` for short factual queries and
`llama-3.3-70b-versatile` for comparative / multi-clause / synthesis queries.
No LLM call is needed to route. Improves cost and latency on simple lookups
without sacrificing depth on hard ones.

### 5. Output evaluator
Returns four flags:

| Flag | Meaning |
|---|---|
| `refusal` | The answer matches a known refusal pattern. |
| `no_context` | 0 chunks were retrieved AND the answer is not a refusal (should never happen given step 8 above; sentinel). |
| `low_similarity` | Top similarity score < 0.55 — answer should be treated with caution even if generated. |
| `possibly_ungrounded` | The model produced a non-refusal but the top score is < 0.45 — strong hallucination risk. |

Plus a structured boolean `metadata.refused` for clean UI gating.

### 6. Multilingual (bonus)
Three prongs:

1. **Embedding:** `EMBEDDING_MODEL` env var. Default English-only (`bge-small-en-v1.5`);
   set to `BAAI/bge-m3` or `intfloat/multilingual-e5-small` for cross-lingual retrieval.
   For e5 models, `query: ` and `passage: ` prefixes are auto-applied.
2. **Generation:** Llama 3.3 70B is multilingual; the system prompt instructs it to
   respond in the same language as the user's question.
3. **PDF extraction:** `pdfjs-dist` handles UTF-8 text in any script.

Determinism: `temperature=0.1` and identical retrieval order (cosine sort + stable
chunk IDs) make outputs reproducible across identical queries on the same PDF.

## Observability

Every upload and query writes a single structured-JSON line:

```json
{"event":"query","document_id":"doc_xxx","conversation_id":"conv_yy",
 "query":"...","classification":"complex","model_used":"llama-3.3-70b-versatile",
 "chunks_retrieved":3,"raw_top_score":0.7421,"tokens_input":934,"tokens_output":128,
 "latency_ms":612,"flags":[],"refused":false}
```

The debug panel in the UI surfaces the same fields plus per-source excerpts and
similarity scores, giving evaluators full transparency on grounding.

## Trade-offs and known limits

| Decision | Trade-off |
|---|---|
| In-memory store | Cold start on serverless drops state → client re-uploads. Fine for demo, not for prod. |
| Cosine + threshold (0.55) | Fast, deterministic. No reranker. Could miss conceptual queries that the embedding model maps to lower scores. |
| 350-word chunks, 75-word overlap | Good for most factual lookups. Long, multi-page concepts may straddle chunks. |
| 8-turn conversation memory | Hits the system-prompt context budget hard with very long histories. Trimmed to last 8 turns. |
| BGE-small default | English only. Multilingual is opt-in via env var, otherwise non-English retrieval degrades. |
| No OCR | Image-only / scanned PDFs are rejected with a 422 error. |
