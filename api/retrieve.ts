import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ensureInitialized } from './_lib/init';
import { retrieve } from './_lib/retrieval';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await ensureInitialized();
  } catch (err) {
    console.error('[retrieve] Init failed:', err);
    return res.status(503).json({ error: 'Service initializing, please retry.' });
  }

  const { query } = req.body;

  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    return res.status(400).json({ error: 'Missing or empty "query" field.' });
  }

  try {
    const result = await retrieve(query.trim());
    return res.status(200).json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[retrieve] Error:', message);
    return res.status(message === 'Retrieval timeout' ? 504 : 500).json({ error: message });
  }
}
