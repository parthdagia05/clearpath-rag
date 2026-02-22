// scripts/ingest.ts
// CLI script to run the full document ingestion pipeline
//
// Usage: npx ts-node scripts/ingest.ts
//
// Pipeline: PDFs → Extract → Chunk → Embed → Persist
// Outputs:
//   backend/data/chunks.json       (chunks without embeddings)
//   backend/data/embeddings.json   (chunks with embeddings)

import path from 'path';
import fs from 'fs';
import { extractAllPdfs } from '../services/pdf.service';
import { chunkAllDocuments } from '../services/chunking.service';
import {
  initializeModel,
  embedBatch,
  getDimension,
} from '../services/embedding.service';
import {
  addDocuments,
  persistToFile,
  getStoreSize,
} from '../services/vectorStore.service';

async function main() {
  const startTime = Date.now();

  // Resolve paths
  const docsDir = path.resolve(__dirname, '../../docs');
  const chunksPath = path.resolve(__dirname, '../data/chunks.json');
  const embeddingsPath = path.resolve(__dirname, '../data/embeddings.json');
  const dataDir = path.dirname(chunksPath);

  console.log('='.repeat(60));
  console.log('[Ingest] ClearPath Document Ingestion Pipeline');
  console.log('='.repeat(60));
  console.log(`[Ingest] Docs directory    : ${docsDir}`);
  console.log(`[Ingest] Chunks output     : ${chunksPath}`);
  console.log(`[Ingest] Embeddings output : ${embeddingsPath}`);
  console.log('');

  // ─── Step 1: Extract PDFs ────────────────────
  console.log('[Ingest] Step 1 — Extracting PDFs...');
  const documents = await extractAllPdfs(docsDir);

  if (documents.length === 0) {
    console.log('[Ingest] No documents to process. Exiting.');
    return;
  }

  console.log(`[Ingest]   Extracted ${documents.length} document(s)`);
  console.log('');

  // ─── Step 2: Chunk documents ─────────────────
  console.log('[Ingest] Step 2 — Chunking documents...');
  const allChunks = chunkAllDocuments(documents);

  const totalChunks = allChunks.length;
  const totalWords = allChunks.reduce(
    (sum, c) => sum + c.text.split(/\s+/).filter((w) => w.length > 0).length,
    0
  );
  const avgChunkSize =
    totalChunks > 0 ? Math.round(totalWords / totalChunks) : 0;

  console.log(`[Ingest]   Total chunks: ${totalChunks}`);
  console.log(`[Ingest]   Avg chunk size: ${avgChunkSize} words`);
  console.log('');

  // Persist raw chunks (without embeddings)
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  fs.writeFileSync(chunksPath, JSON.stringify(allChunks, null, 2), 'utf-8');
  console.log(`[Ingest]   Raw chunks written to ${chunksPath}`);
  console.log('');

  // ─── Step 3: Generate embeddings ─────────────
  console.log('[Ingest] Step 3 — Generating embeddings...');
  const embedStart = Date.now();

  await initializeModel();

  const texts = allChunks.map((c) => c.text);
  const embeddings = await embedBatch(texts);

  // Attach embeddings to chunks
  for (let i = 0; i < allChunks.length; i++) {
    allChunks[i].embedding = embeddings[i];
  }

  const embedElapsed = Date.now() - embedStart;
  const dimension = getDimension();

  console.log('');
  console.log(`[Ingest]   Embedding time: ${embedElapsed}ms`);
  console.log(`[Ingest]   Embedding dimension: ${dimension}`);
  console.log('');

  // ─── Step 4: Store in vector store and persist ─
  console.log('[Ingest] Step 4 — Storing vectors...');
  addDocuments(allChunks);
  persistToFile(embeddingsPath);

  // ─── Summary ─────────────────────────────────
  const totalElapsed = Date.now() - startTime;

  console.log('');
  console.log('='.repeat(60));
  console.log('[Ingest] Pipeline Complete');
  console.log('='.repeat(60));
  console.log(`[Ingest]   Documents processed  : ${documents.length}`);
  console.log(`[Ingest]   Total chunks          : ${totalChunks}`);
  console.log(`[Ingest]   Average chunk size    : ${avgChunkSize} words`);
  console.log(`[Ingest]   Embedding dimension   : ${dimension}`);
  console.log(`[Ingest]   Total vectors stored  : ${getStoreSize()}`);
  console.log(`[Ingest]   Embedding time        : ${embedElapsed}ms`);
  console.log(`[Ingest]   Total pipeline time   : ${totalElapsed}ms`);
  console.log('='.repeat(60));

  // ─── Dimension consistency check ─────────────
  const dims = new Set(embeddings.map((e) => e.length));
  if (dims.size === 1) {
    console.log(`[Ingest] ✅ All embeddings have consistent dimension: ${dimension}`);
  } else {
    console.error(`[Ingest] ❌ Inconsistent embedding dimensions: ${[...dims].join(', ')}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[Ingest] Fatal error:', err);
  process.exit(1);
});
