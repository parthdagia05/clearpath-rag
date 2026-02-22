// scripts/test-scores.ts
// Quick diagnostic: print raw similarity scores (before threshold filter)
import path from 'path';
import { loadFromFile, search } from '../services/vectorStore.service';
import { initializeModel, embed } from '../services/embedding.service';

async function main() {
  const embeddingsPath = path.resolve(__dirname, '../data/embeddings.json');
  loadFromFile(embeddingsPath);
  await initializeModel();

  const queries = [
    'What is the return policy?',
    'How do I reset my password?',
    'Tell me about shipping options',
    'What payment methods do you accept?',
    'How do I contact support?',
  ];

  for (const q of queries) {
    const vec = await embed(q);
    const results = search(vec, 5);
    console.log(`\nQuery: "${q}"`);
    if (results.length === 0) {
      console.log('  (no results - store may be empty)');
    } else {
      results.forEach((r, i) => {
        console.log(`  ${i+1}. score=${r.score.toFixed(4)} doc=${r.document_name} chunk=${r.id}`);
        console.log(`     text: ${r.content.substring(0, 80)}...`);
      });
    }
  }
}

main().catch(err => { console.error(err); process.exit(1); });
