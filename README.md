# PDF-Constrained Conversational Agent (STAIR × Scaler — Task 3)

A conversational agent that you can chat with about **any PDF you upload**. Answers
are strictly grounded in the document — out-of-scope or unsupported questions are
explicitly refused with a fixed sentence. Every factual statement carries an inline
`[Page N]` citation.

> Originally built as a fixed-corpus support bot (`clearpath-rag`); refactored to
> satisfy Task 3 of the STAIR × Scaler take-home assignment.

**Live demo:** [clearpath-rag.vercel.app](https://clearpath-rag.vercel.app)

## Submission contents

| File | Purpose |
|---|---|
| [`README.md`](README.md) | This file — quick start + overview. |
| [`TECHNICAL_NOTE.md`](TECHNICAL_NOTE.md) | Architecture, decisions, trade-offs (required by spec). |
| [`TASK3_TESTING.md`](TASK3_TESTING.md) | Sample PDF + 5 valid queries + 3 out-of-scope queries (required by spec). |
| [`docs/`](docs/) | 30 sample text-based PDFs you can use as inputs. |
| [`api/`](api/) | Vercel serverless functions (production runtime). |
| [`backend/`](backend/) | Thin Express adapter for local dev. |
| [`client/`](client/) | React + Vite frontend (chat UI + debug panel). |

## What it does

| Task 3 requirement | How this app satisfies it |
|---|---|
| Accept any PDF as input | `POST /api/upload` — raw PDF bytes, returns `document_id`. |
| Conversational querying | Per-`conversation_id` memory window of the last 8 turns. |
| Answer **only** from the PDF | System prompt bounds knowledge to "the only knowledge you may use" + zero-context short-circuit. |
| Explicitly refuse out-of-scope | Two canonical refusal sentences, surfaced via `metadata.refused`. |
| Citations | Inline `[Page N]` in every answer + structured `sources[]` with relevance scores. |
| Bonus: multilingual | `EMBEDDING_MODEL` env swap to `BAAI/bge-m3` for retrieval; LLM responds in user's language. |

## Quick start (local)

Prereqs: Node 18+, a Groq API key, a HuggingFace API token with "Inference Providers" permission.

```bash
git clone https://github.com/parthdagia05/clearpath-rag.git
cd clearpath-rag

# 1. Root and backend deps
npm install
cd backend && npm install && cd ..
cd client && npm install && cd ..

# 2. Configure
cp .env.example backend/.env
# edit backend/.env and set GROQ_API_KEY and HF_API_KEY
# (optional) set EMBEDDING_MODEL=BAAI/bge-m3 for multilingual retrieval

# 3. Run (two terminals)
cd backend && npm run dev      # http://localhost:3001
cd client  && npm run dev      # http://localhost:5173
```

Then open `http://localhost:5173`, drop in a PDF, and ask away.

## API contract

### `POST /api/upload`
Upload a PDF. Returns a `document_id` valid for 1 hour.

```bash
curl -s -X POST http://localhost:3001/api/upload \
  -H "Content-Type: application/pdf" \
  -H "X-Filename: my.pdf" \
  --data-binary @my.pdf
```

```json
{
  "document_id": "doc_abc123",
  "filename": "my.pdf",
  "page_count": 4,
  "chunk_count": 7,
  "conversation_id": "conv_zzz",
  "embedding_model": "BAAI/bge-small-en-v1.5",
  "uploaded_at": 1730000000000
}
```

### `POST /api/query`
Ask a question. Requires `document_id`. Optionally pass `conversation_id` for memory.

```bash
curl -s -X POST http://localhost:3001/api/query \
  -H "Content-Type: application/json" \
  -d '{"document_id":"doc_abc123","question":"How do I cancel?"}'
```

```json
{
  "answer": "To cancel: 1) Go to Settings → Billing → Subscription, 2) Click 'Cancel Subscription'... [Page 2]",
  "metadata": {
    "model_used": "llama-3.1-8b-instant",
    "classification": "simple",
    "tokens": { "input": 612, "output": 88 },
    "latency_ms": 530,
    "chunks_retrieved": 2,
    "evaluator_flags": [],
    "refused": false
  },
  "sources": [
    {
      "document": "21_Account_Management_FAQ.pdf",
      "page": 2,
      "relevance_score": 0.7614,
      "excerpt": "To cancel your subscription: 1. Go to Settings → Billing → Subscription..."
    }
  ],
  "conversation_id": "conv_zzz",
  "document_id": "doc_abc123"
}
```

Errors:
- `400` — missing `question` or `document_id`
- `404` (`code: DOCUMENT_NOT_FOUND`) — document expired or server restarted, re-upload
- `405` — wrong HTTP method
- `500` — LLM / retrieval failure

### `GET /api/documents` / `?document_id=...`
List all in-memory documents, or fetch one's metadata.

### `DELETE /api/documents?document_id=...`
Remove a document from memory (called by the UI when you click "Upload another PDF").

### `GET /api/health`
Returns `{"status":"ok"}`.

## How grounding works

1. PDF → `pdfjs-dist` extracts per-page text, cleans whitespace.
2. Each page is chunked (350 words, 75-word overlap, sentence-boundary snapped).
3. Chunks are embedded via HuggingFace Inference API → kept in-memory keyed by `document_id`.
4. On a query: cosine top-K=5, threshold ≥ 0.55. Top 3 are sent to the LLM as
   `[Excerpt N | Page M | filename: …]` blocks.
5. Strict system prompt with two canonical refusals; temperature `0.1`.
6. If 0 chunks pass threshold → the LLM is **not called**, refusal returned directly.

See [`TECHNICAL_NOTE.md`](TECHNICAL_NOTE.md) for the full pipeline and trade-offs.

## Models

| Layer | Default | Why |
|---|---|---|
| Embeddings | `BAAI/bge-small-en-v1.5` | 384-dim, fast on HF Inference API. Swap to `BAAI/bge-m3` (1024-dim) or `intfloat/multilingual-e5-small` (384-dim) for multilingual retrieval. |
| LLM (simple) | `llama-3.1-8b-instant` (Groq) | Low latency for short factual queries. |
| LLM (complex) | `llama-3.3-70b-versatile` (Groq) | Multi-section synthesis, multilingual generation. |

A deterministic rule-based router (no LLM call) picks between the two.

## Vercel deployment

```bash
vercel
```

Set env vars in the dashboard:

| Variable | Required | Notes |
|---|---|---|
| `GROQ_API_KEY` | yes | Groq cloud API key |
| `HF_API_KEY` | yes | HF token with "Inference Providers" permission |
| `EMBEDDING_MODEL` | no | Default `BAAI/bge-small-en-v1.5`. Set for multilingual. |

The `vercel.json` already grants `/api/upload` 60s and `/api/query` 30s. Frontend
is built from `client/` to static assets; API routes run as serverless functions.

## Project layout

```
clearpath-rag/
├── api/                                 # Vercel serverless functions
│   ├── upload.ts                        # POST /api/upload (raw PDF bytes)
│   ├── query.ts                         # POST /api/query (PDF chat)
│   ├── retrieve.ts                      # POST /api/retrieve (debug)
│   ├── documents.ts                     # GET / DELETE /api/documents
│   ├── health.ts                        # GET /api/health
│   └── _lib/
│       ├── pdfProcessor.ts              # pdfjs-dist extract + chunker
│       ├── embedding.ts                 # HF Inference API + multilingual prefix
│       ├── retrieval.ts                 # cosine top-K, threshold, sort
│       ├── documentStore.ts             # in-memory PDF store, 1h TTL
│       ├── conversationStore.ts         # 8-turn rolling memory, scoped by document
│       ├── router.ts                    # deterministic simple/complex classifier
│       ├── llm.ts                       # Groq chat completions
│       ├── evaluator.ts                 # refusal detection + flags
│       ├── similarity.ts                # cosine similarity
│       ├── types.ts                     # shared TS types
│       └── init.ts                      # no-op (legacy compat)
├── backend/
│   ├── index.ts                         # Express dev server (thin adapter to api/*)
│   ├── package.json
│   └── tsconfig.json
├── client/
│   └── src/
│       ├── App.tsx
│       ├── components/
│       │   ├── PdfUpload.tsx            # drag-drop upload card
│       │   ├── ChatWindow.tsx           # chat UI
│       │   └── DebugPanel.tsx           # live metadata + citations
│       ├── services/api.ts              # axios client (upload + query + delete)
│       └── types/index.ts
├── docs/                                # 30 sample PDFs for testing
├── TECHNICAL_NOTE.md                    # architecture write-up
├── TASK3_TESTING.md                     # sample PDF + valid/invalid queries
├── vercel.json
└── package.json
```

## Limitations

- **OCR not supported.** Scanned/image-only PDFs return 422.
- **Cold-start state loss.** On Vercel cold start, in-memory documents are gone — the
  client gets `DOCUMENT_NOT_FOUND` and re-uploads. For multi-instance prod, swap
  `documentStore.ts` for an external vector DB.
- **Single embedding model per deployment.** Switching `EMBEDDING_MODEL` requires
  re-uploading PDFs (vectors must use the same model as the query).
- **15 MB upload cap.** Adjust in `api/upload.ts` if your PDFs are larger.
- **No reranker.** Bi-encoder cosine only. A cross-encoder (e.g. `ms-marco-MiniLM`)
  would improve top-3 ranking on conceptual queries — explicit follow-up.
