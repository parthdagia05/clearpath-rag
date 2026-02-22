// scripts/seed-embeddings.ts
// Seeds the vector store with test chunks for retrieval testing
// Run: npx ts-node scripts/seed-embeddings.ts

import path from 'path';
import { initializeModel, embedBatch } from '../services/embedding.service';
import { addDocuments, persistToFile } from '../services/vectorStore.service';
import { Chunk } from '../types';

const TEST_CHUNKS = [
  'RETURN POLICY. Customers may return products within 30 days of purchase for a full refund. Items must be in their original packaging and unused condition. Damaged or opened products may incur a 15 percent restocking fee. Refunds are processed within 5 to 7 business days after the returned item is received at our warehouse.',
  'SHIPPING INFORMATION. Standard shipping takes 5 to 10 business days for domestic orders. Express shipping is available for an additional 15 dollars and delivers within 2 to 3 business days. International shipping may take 10 to 20 business days depending on destination. Free shipping is available on orders over 75 dollars.',
  'PAYMENT METHODS. We accept all major credit cards including Visa, Mastercard, American Express, and Discover. PayPal and Apple Pay are also accepted. Gift cards can be purchased in denominations of 25, 50, and 100 dollars. Payment plans are available for purchases over 200 dollars.',
  'ACCOUNT MANAGEMENT. To create an account visit our website and click Sign Up. You can reset your password using the Forgot Password link on the login page. Account holders receive exclusive member discounts and early access to sales events. You can update your email address and phone number in the My Account section.',
  'WARRANTY INFORMATION. All products come with a one year limited warranty covering manufacturing defects. Extended warranty plans are available for two or three years. Warranty claims must be submitted with proof of purchase. Warranty does not cover damage from misuse, accidents, or unauthorized modifications.',
  'CONTACT SUPPORT. Our customer support team is available Monday through Friday from 9 AM to 6 PM Eastern Time. You can reach us by email at support@clearpath.com or by phone at 1-800-555-0199. Live chat is available on our website during business hours. For urgent issues outside business hours please email us and we will respond within 24 hours.',
  'LOYALTY PROGRAM. Join our ClearPath Rewards program to earn points on every purchase. For every dollar spent you earn 1 point. Once you reach 500 points you can redeem them for a 25 dollar discount. Gold members who spend over 1000 dollars per year receive double points and free express shipping on all orders.',
  'PRODUCT EXCHANGES. If you need a different size or color we offer free exchanges within 30 days of purchase. Simply initiate an exchange request through your account dashboard or contact our support team. The replacement item will be shipped once we receive the original product. Exchanges are not available for clearance items.',
];

async function main() {
  console.log('[Seed] Seeding vector store with test data...');

  await initializeModel();

  const embeddings = await embedBatch(TEST_CHUNKS);

  const chunks: Chunk[] = TEST_CHUNKS.map((text, i) => ({
    chunk_id: `seed-chunk-${i}`,
    document_name: 'clearpath_support_kb',
    page_number: i + 1,
    text,
    embedding: embeddings[i],
  }));

  addDocuments(chunks);

  const outputPath = path.resolve(__dirname, '../data/embeddings.json');
  persistToFile(outputPath);

  console.log(`[Seed] Done. ${chunks.length} chunks with embeddings persisted.`);
}

main().catch((err) => {
  console.error('[Seed] Error:', err);
  process.exit(1);
});
