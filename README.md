# ClearPath — RAG-Based Customer Support Chatbot

ClearPath is a retrieval-augmented generation (RAG) system built to answer customer questions using ClearPath SaaS product documentation. It uses a deterministic rule-based router to classify query complexity, routes to appropriate Groq Llama models, and applies a post-response output evaluator to flag low-confidence answers. A minimal React chat UI with an integrated debug panel provides transparency into every pipeline stage.

---

## Architecture Overview

The system follows a linear pipeline from user query to structured response:

```
User → POST /query → Retrieval → Router → Groq LLM → Evaluator → Response
```

**Core components:**

| Component | Technology |
|-----------|-----------|
| Embeddings | BGE-small-en-v1.5 via `@xenova/transformers` (384 dimensions) |
| Vector Store | In-memory cosine similarity search with JSON file persistence |
| Retrieval | Top-5 nearest neighbors retrieved, top-3 highest scoring passed to LLM |
| Similarity Threshold | 0.60 (chunks below this are filtered out) |
| Chunking | Heading-aware splitting + sliding window (350 words max, 75-word overlap) |
| Router | Deterministic rule-based classifier (no LLM calls) |
| LLM | Groq API — Llama 3.1 8B (simple) / Llama 3.3 70B (complex) |
| Evaluator | Three-flag diagnostic system (no_context, refusal, low_similarity) |
| Frontend | React + Vite with debug panel showing full metadata |

---

## RAG Pipeline

### Document Ingestion

1. **PDF Extraction** — PDFs are parsed page-by-page using `pdfjs-dist` (legacy build for CommonJS compatibility). Per-page text extraction preserves document structure.

2. **Text Cleaning** — Raw text undergoes normalization: line break collapsing, whitespace normalization, and repeating header/footer removal.

3. **Chunking Strategy** — Documents are split using a heading-aware sliding window approach:
   - **Max chunk size:** 350 words
   - **Overlap:** 75 words (stride = 275)
   - **Sentence-boundary snapping:** Chunk boundaries are adjusted to avoid splitting mid-sentence
   - Headings (lines starting with `#` or all-caps lines) trigger chunk boundaries to preserve semantic coherence

4. **Embedding Generation** — Each chunk is embedded using BGE-small-en-v1.5 (384-dimensional vectors) and persisted to `data/embeddings.json`.

### Retrieval

1. The user query is embedded using the same model.
2. Cosine similarity is computed against all stored chunk vectors.
3. The top-5 results are returned, filtered by the 0.60 similarity threshold.
4. Only the top-3 highest-scoring chunks are passed to the LLM as context (each trimmed to 250 words max to control token cost).

> **This system does NOT use LangChain, LlamaIndex, or any managed RAG services.** All retrieval logic — embedding, similarity search, threshold filtering — is implemented from scratch.

---

## Model Router

The router uses deterministic, rule-based classification with no LLM calls.

### Rules

1. **Input normalization:** `question.toLowerCase().trim()`

2. **Complex keyword detection** — If the query contains any of the following keywords, it is classified as complex:
   ```
   compare, difference, explain, summarize, analyse, analyze, why, how, when,
   pros, cons, advantages, disadvantages, steps, across, between, vs, versus
   ```

3. **Word count check** — Queries with 8 or more words are classified as complex.

4. **Question mark count** — Queries with more than 1 question mark are classified as complex.

### Classification Logic

```
IF word_count < 8 AND no complex keywords AND question_marks <= 1
  → simple → llama-3.1-8b-instant
ELSE
  → complex → llama-3.3-70b-versatile
```

All routing decisions are logged in structured JSON format to the console:

```json
{
  "query": "...",
  "classification": "simple|complex",
  "model_used": "...",
  "tokens_input": 0,
  "tokens_output": 0,
  "latency_ms": 0
}
```

---

## Output Evaluator

The evaluator runs after the LLM response and returns an array of diagnostic flags.

| Flag | Condition |
|------|-----------|
| `no_context` | 0 chunks retrieved AND the answer is not a refusal |
| `refusal` | Answer contains refusal phrases: "not found", "cannot find", "do not have", "not mentioned", "I don't know" |
| `low_similarity` | Top similarity score is below 0.60 |

Flags are **informational** — they do not block the response. They are surfaced in the frontend debug panel and included in the API response metadata. When any flags are present, a warning banner is shown in the chat UI.

---

## API Contract

### `POST /query`

**Request:**

```json
{
  "question": "How do I reset my password?",
  "conversation_id": "conv_abc12345"
}
```

- `question` (string, required) — The user's question.
- `conversation_id` (string, optional) — If provided, echoed back. If omitted, a new ID is generated (`conv_` + 8 random alphanumeric characters).

**Response:**

```json
{
  "answer": "To reset your password, click 'Forgot Password'...",
  "metadata": {
    "model_used": "llama-3.3-70b-versatile",
    "classification": "complex",
    "tokens": {
      "input": 934,
      "output": 128
    },
    "latency_ms": 530,
    "chunks_retrieved": 3,
    "evaluator_flags": []
  },
  "sources": [
    {
      "document": "21_Account_Management_FAQ.pdf",
      "page": null,
      "relevance_score": 0.7614
    }
  ],
  "conversation_id": "conv_qwc2vnyh"
}
```

**Error responses:**

- `400` — Missing or empty `question` field.
- `500` — Retrieval or LLM failure.

---

## How to Run Locally

### Prerequisites

- Node.js 18+
- A Groq API key ([console.groq.com](https://console.groq.com))

### Backend

```bash
git clone (https://github.com/parthdagia05/clearpath-rag.git)
cd clearpath-rag/backend
npm install
```

Create a `.env` file:

```
GROQ_API_KEY=gsk_your_key_here
PORT=3001
```

Ingest documents and start the server:

```bash
npx ts-node scripts/ingest.ts    # one-time ingestion
npm run dev                       # starts on http://localhost:3001
```

### Frontend

```bash
cd clearpath-rag/client
npm install
npm run dev                       # starts on http://localhost:5173
```

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GROQ_API_KEY` | Yes | — | Groq API key for LLM calls |
| `PORT` | No | 3001 | Backend server port |

---

## Models Used

| Model | Use Case | Rationale |
|-------|----------|-----------|
| `llama-3.1-8b-instant` | Simple queries (factual lookups, short answers) | Low latency (~150ms), low token cost. Suitable for straightforward questions that don't require multi-step reasoning. |
| `llama-3.3-70b-versatile` | Complex queries (comparisons, summaries, multi-part questions) | Higher reasoning capability. Handles synthesis across multiple document chunks, trade-off analysis, and structured output generation. |

Two models are used to balance **cost vs. reasoning quality**. Simple queries (estimated ~60% of traffic) use the 8B model at a fraction of the cost, while complex queries route to the 70B model only when deeper reasoning is needed.

---

## Bonus Challenges

No bonus challenges were implemented. Development focus was placed on robustness of the core layers: ensuring reliable PDF ingestion across all 30 documents, accurate retrieval with appropriate threshold tuning, correct router classification for edge cases, and a complete evaluator flag system. Shipping a stable, well-tested core pipeline was prioritized over additional features.

---

## Known Limitations

1. **Static similarity threshold (0.60)** — A single threshold applies to all queries. Conceptual queries may need a lower threshold while factual lookups could use a higher one. An adaptive threshold or per-query calibration would improve precision.

2. **No cross-encoder reranking** — Initial retrieval uses bi-encoder cosine similarity only. A cross-encoder reranker (e.g., ms-marco-MiniLM) on top of retrieved candidates would significantly improve ranking quality.

3. **No conversation memory** — Each query is processed independently. The `conversation_id` is tracked but not used for multi-turn context. A sliding window of previous turns would enable follow-up questions.

4. **No streaming** — Responses are returned as a single JSON payload after the full LLM generation completes. Server-sent events (SSE) would improve perceived latency.

5. **Context trimming may remove detail** — Chunks are trimmed to 250 words before being sent to the LLM. For information-dense documents, this may cut off relevant trailing content. A smarter extraction strategy (e.g., extractive summarization) would be more robust.

6. **Single embedding model** — BGE-small-en-v1.5 is lightweight but may underperform on domain-specific terminology compared to larger or fine-tuned models.
