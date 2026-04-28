import type { VercelRequest, VercelResponse } from '@vercel/node';
import { retrieve } from './_lib/retrieval';
import { hasDocument } from './_lib/documentStore';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { query, document_id } = req.body || {};

  if (!document_id || typeof document_id !== 'string') {
    return res.status(400).json({ error: 'Missing "document_id". Upload a PDF first.' });
  }
  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    return res.status(400).json({ error: 'Missing or empty "query" field.' });
  }
  if (!hasDocument(document_id)) {
    return res.status(404).json({ error: 'document_id not found.', code: 'DOCUMENT_NOT_FOUND' });
  }

  try {
    const result = await retrieve(query.trim(), document_id);
    return res.status(200).json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
}
