# Written Answers

## Q1 — Routing Logic

The ClearPath router uses deterministic, rule-based classification to select between Llama 3.1 8B (simple) and Llama 3.3 70B (complex). The rules evaluate three features on the normalized (lowercased, trimmed) input: word count, presence of complex keywords (`compare`, `explain`, `summarize`, `why`, `how`, `steps`, `between`, `vs`, and 10 others), and question mark count. If word count is below 8, no complex keywords are detected, and there is at most one question mark, the query is routed to the 8B model. Otherwise, it routes to 70B.

During testing, the query *"Compare the Pro and Enterprise plans and explain when each should be used"* was initially misclassified as simple because the original keyword list only contained six terms and missed `compare`. This produced a shallow, incomplete answer from the 8B model. The fix was to expand the keyword list to 18 terms covering comparative, analytical, and temporal reasoning patterns. After the fix, the query correctly routes to 70B and produces a detailed comparison pulling from three separate documents.

To improve further without using an LLM, a scoring-based approach could be implemented: assign weighted scores for keyword presence, word count, clause count (splitting on conjunctions like "and"), and entity count, then threshold on the aggregate score rather than using binary rules. A lightweight intent classifier trained on labeled query pairs would also capture nuance that keyword matching misses.

---

## Q2 — Retrieval Failures

The query *"Summarize the key policies mentioned in the employee handbook and onboarding checklist"* initially retrieved 0 chunks because similarity scores for the most relevant documents (`18_Onboarding_Checklist.pdf` at 0.6063) fell below the original 0.65 threshold. The system correctly identified directionally relevant content — the onboarding checklist document surfaced in the top-5 candidates — but the threshold filter discarded it.

The root cause is semantic drift: the query uses abstract terms ("key policies", "employee handbook") while the actual document content uses procedural language ("initial setup", "inviting team members", "creating a first project"). The BGE-small embedding model captures some semantic overlap but the cosine similarity score reflects this vocabulary mismatch, landing in the 0.60–0.63 range rather than above 0.65.

The fix was to lower the similarity threshold from 0.65 to 0.60. This improved recall — the onboarding document now passes filtering and provides useful context — without introducing noise, since scores below 0.60 genuinely correspond to irrelevant documents in our corpus (e.g., shipping and return policy queries score 0.50–0.55).

The tradeoff is explicit: lowering the threshold increases recall (fewer missed relevant chunks) at the cost of slightly reduced precision (potential for marginally relevant chunks). For a customer support system, missing a relevant answer is worse than including a slightly tangential context chunk, so this tradeoff is justified.

---

## Q3 — Cost and Scale

**Assumptions:** Average input tokens ≈ 600, average output tokens ≈ 120, 5,000 queries/day, estimated 60% simple (8B) and 40% complex (70B).

**Daily token breakdown:**

| Segment | Queries | Input Tokens | Output Tokens | Total Tokens |
|---------|---------|-------------|--------------|-------------|
| Simple (60%) | 3,000 | 1,800,000 | 360,000 | 2,160,000 |
| Complex (40%) | 2,000 | 1,200,000 | 240,000 | 1,440,000 |
| **Total** | **5,000** | **3,000,000** | **600,000** | **3,600,000** |

The **biggest cost driver is input token count**, specifically the context chunks concatenated into each prompt. Input tokens outnumber output tokens 5:1 and are the dominant factor in per-request cost.

**Highest ROI optimization:** Reducing the chunk trim limit from 250 to 180 words. This would reduce average input tokens from ~600 to ~430 per query, cutting daily input tokens by ~28% (~840,000 tokens/day saved). The information loss is minimal because most chunks contain redundant preambles and formatting that don't contribute to answer quality.

**Optimization to avoid:** Lowering the similarity threshold below 0.60 to retrieve more chunks. While this increases recall, it inflates context size with marginally relevant content, directly increasing input tokens without proportional answer quality improvement. At 0.55, irrelevant chunks begin appearing, which both wastes tokens and can confuse the LLM.

---

## Q4 — What Is Broken

The biggest flaw in this system is the **static similarity threshold combined with the absence of a reranking layer**. A single threshold (0.60) applied uniformly across all query types cannot account for the inherent variability in how different question styles map to document embeddings. Factual queries ("How do I reset my password?") produce sharp, high-scoring matches (0.76), while conceptual queries ("Summarize key policies") produce diffuse, lower-scoring matches (0.60–0.63). The same threshold that correctly filters noise for factual queries can incorrectly discard relevant content for conceptual ones.

**Why shipped anyway:** Given time and scope constraints, a static threshold provides deterministic, predictable behavior that is easy to debug and explain. A dynamic threshold or reranker introduces additional complexity, latency, and a dependency on another model, which was deemed higher-risk for a submission than the known limitation of a fixed cutoff.

**Most direct fix:** Implement a two-stage retrieval system. First, retrieve top-K candidates using the current bi-encoder cosine similarity (fast, broad recall). Second, re-score the candidates using a cross-encoder reranker such as `cross-encoder/ms-marco-MiniLM-L-6-v2`, which processes query-document pairs jointly and produces more accurate relevance scores. Alternatively, a hybrid retrieval approach combining BM25 (lexical matching) with embedding-based semantic search would capture both exact keyword matches and conceptual relevance, addressing the vocabulary mismatch problem observed in queries like the handbook/onboarding example.

---

## AI Usage

The following AI prompts were used during development of this project. They are listed verbatim.

### Prompt 1 — Initial Backend Architecture

```
We are now implementing the FINAL backend architecture to fully comply with the AI Systems Intern Take-Home Assignment specification.

This must be production-ready and match the API contract EXACTLY.

Do not partially implement anything.
Do not leave TODOs.
Do not mock LLM calls.
Do not refactor unrelated systems.
Do not change ingestion or retrieval logic.

[Full 10-step specification for POST /query endpoint, router, evaluator, LLM integration, logging, response format, and error handling]
```

### Prompt 2 — Frontend Upgrade

```
We are upgrading the frontend to fully comply with the assignment evaluation criteria.

Do NOT change backend.
Do NOT change API structure.
Only modify frontend.

[5-step specification for API call update, response handling, debug panel UI, error surface, and UI polish]
```

### Prompt 3 — Router Stabilization and Retrieval Threshold Adjustment

```
SECTION 1 — Fix Router Misclassification (MANDATORY)

Problem:
Complex reasoning queries like:
"Compare the Pro and Enterprise plans…"
"Summarize the key policies…"
are being classified as simple.

[Expanded keyword list, structural reasoning detection rules, threshold adjustment from 0.65 to 0.60, top-5 retrieval change, token trimming with trimToWords, evaluator refinement]
```

### Prompt 4 — Documentation Generation

```
We are preparing the final submission for the ClearPath AI Systems Intern Take-Home Assignment.

You must generate two files:
README.md
Written_answers.md

[Full specification for all 10 README sections and all 4 written answers with word count requirements, real examples, and AI usage documentation]
```
