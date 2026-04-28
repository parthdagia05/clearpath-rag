import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDocument, removeDocument, listDocuments } from './_lib/documentStore';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const documentId = (req.query?.document_id as string) || '';

  if (req.method === 'GET') {
    if (documentId) {
      const doc = getDocument(documentId);
      if (!doc) return res.status(404).json({ error: 'Document not found.' });
      return res.status(200).json({
        document_id: doc.document_id,
        filename: doc.filename,
        page_count: doc.page_count,
        chunk_count: doc.chunk_count,
        uploaded_at: doc.uploaded_at,
      });
    }
    return res.status(200).json({ documents: listDocuments() });
  }

  if (req.method === 'DELETE') {
    if (!documentId) {
      return res.status(400).json({ error: 'Missing document_id query parameter.' });
    }
    const removed = removeDocument(documentId);
    if (!removed) return res.status(404).json({ error: 'Document not found.' });
    return res.status(200).json({ document_id: documentId, deleted: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
