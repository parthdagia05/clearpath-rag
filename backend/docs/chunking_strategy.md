# ClearPath Document Chunking Strategy

## Parameters

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Max chunk size | 800 tokens (words) | Described below |
| Overlap | 150 tokens (words) | Described below |
| Token counting | Word-based approximation | Simple, no external tokenizer needed; close enough for English text (~1.3 tokens per word on average) |

---

## Why 800 Tokens?

800 tokens is a sweet spot between context richness and retrieval precision:

- **Too small (< 300):** Chunks lose surrounding context. A sentence about a refund policy becomes meaningless without the paragraph it belongs to. Retrieval returns fragments that require the LLM to guess at meaning.
- **Too large (> 1500):** Chunks contain multiple unrelated topics. A search for "password reset" might return a 2000-word chunk where only one sentence is relevant — the rest is noise that confuses the LLM and wastes tokens.
- **800 is Goldilocks:** Large enough to preserve a full paragraph or sub-section with context, small enough that the top-K retrieved chunks stay focused on the user's actual question.

Additionally, 800 words ≈ ~1000 actual LLM tokens. With `llama-3.1-8b-instant` having an 8K context window, we can comfortably fit 3–5 chunks + the system prompt + user query + response budget without truncation.

---

## Why 150 Token Overlap?

The sliding window overlap ensures context is not lost at chunk boundaries:

- **The boundary problem:** Without overlap, if a key sentence spans two chunks, neither chunk contains the full thought. Cosine similarity may fail to match either chunk to the user's query.
- **150 words ≈ 2–3 sentences:** This is enough to carry forward the concluding context of one chunk into the beginning of the next, so that both chunks are independently meaningful.
- **Why not more?** Larger overlaps (e.g., 300+) lead to excessive duplication, inflating storage and causing near-identical chunks to compete in retrieval rankings. 150 is ~19% of 800, a well-established ratio in chunking literature.

---

## Tradeoffs: Larger vs. Smaller Chunks

| Dimension | Smaller chunks (~200–400) | Larger chunks (~1000–2000) |
|-----------|---------------------------|----------------------------|
| **Retrieval precision** | ✅ More focused, fewer off-topic tokens | ❌ Diluted by unrelated content |
| **Context preservation** | ❌ Loses surrounding context | ✅ Keeps full section context |
| **LLM token budget** | ✅ More chunks fit in context window | ❌ Fewer chunks fit, risk of truncation |
| **Storage / index size** | ❌ More chunks = larger index | ✅ Fewer chunks = smaller index |
| **Embedding quality** | ❌ Short text → weaker semantic signal | ✅ More text → richer embeddings |
| **Overlap waste** | ❌ Higher overlap-to-content ratio | ✅ Lower overlap-to-content ratio |

**Conclusion:** 800 tokens balances all of these dimensions. It can be tuned later based on real-world retrieval quality metrics.

---

## Why Heading-Aware Splitting Improves Retrieval

### The Problem with Naive Splits

Token-count-only splitting treats all text as a flat stream. A 800-word window might slice through the middle of a section:

```
[Chunk 1] ...end of "Returns Policy"... | ...start of "Shipping Info"...
[Chunk 2] ...end of "Shipping Info"... | ...start of "Payment Methods"...
```

Both chunks are topically muddled. Neither cleanly matches a query about "return window" or "shipping times."

### How Heading-Aware Splitting Helps

By detecting headings (ALL CAPS lines, markdown `#` headings) and using them as primary split points:

1. **Chunks align with topics:** Each chunk corresponds to a logical section of the document, matching how authors organize information.
2. **Better embeddings:** A chunk titled "REFUND POLICY" followed by its content produces an embedding that clusters tightly with refund-related queries.
3. **Cleaner retrieval:** Top-K results contain whole sections instead of fragments, giving the LLM complete, coherent context.
4. **Paragraph fallback:** Within large sections, paragraph boundaries provide natural secondary split points that still respect topic unity.
5. **Strict split as safety net:** If a section is >800 words with no paragraph breaks (e.g., a dense legal paragraph), the word-based split ensures we never exceed the limit.

This three-tier approach (headings → paragraphs → word split) mimics how a human would break a document into meaningful excerpts.
