import type { VercelRequest, VercelResponse } from '@vercel/node';
import { extractPdf, chunkDocument } from './_lib/pdfProcessor';
import { embedBatch } from './_lib/embedding';
import { addDocument, generateDocumentId } from './_lib/documentStore';
import { generateConversationId } from './_lib/conversationStore';
import type { UploadResponse } from './_lib/types';

export const config = {
  api: {
    bodyParser: false,
  },
  maxDuration: 60,
};

const MAX_BYTES = 15 * 1024 * 1024;

async function readBody(req: VercelRequest): Promise<Buffer> {
  const chunks: Uint8Array[] = [];
  let total = 0;
  for await (const chunk of req as any) {
    const src = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    const view = new Uint8Array(src.buffer, src.byteOffset, src.byteLength);
    total += view.length;
    if (total > MAX_BYTES) {
      throw new Error('PDF exceeds 15MB limit.');
    }
    chunks.push(view);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const filename = (req.headers['x-filename'] as string) || 'upload.pdf';
  const contentType = (req.headers['content-type'] || '').toLowerCase();

  if (!contentType.includes('pdf') && !contentType.includes('octet-stream')) {
    return res.status(400).json({
      error:
        'Content-Type must be application/pdf or application/octet-stream. Send the raw PDF in the body.',
    });
  }

  let buffer: Buffer;
  try {
    buffer = await readBody(req);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to read upload.';
    return res.status(413).json({ error: msg });
  }

  if (buffer.length === 0) {
    return res.status(400).json({ error: 'Empty body. Send the PDF bytes.' });
  }

  // basic PDF magic check
  if (
    buffer.length < 4 ||
    buffer[0] !== 0x25 ||
    buffer[1] !== 0x50 ||
    buffer[2] !== 0x44 ||
    buffer[3] !== 0x46
  ) {
    return res.status(400).json({
      error: 'Body does not look like a PDF (missing %PDF header).',
    });
  }

  const startedAt = Date.now();

  try {
    const extracted = await extractPdf(buffer, sanitizeFilename(filename));
    if (extracted.fullText.trim().length === 0) {
      return res.status(422).json({
        error:
          'No extractable text found in the PDF. Scanned/image-only PDFs are not supported (no OCR).',
      });
    }

    const chunks = chunkDocument(extracted);
    if (chunks.length === 0) {
      return res.status(422).json({ error: 'PDF produced no chunks after processing.' });
    }

    const vectors = await embedBatch(
      chunks.map((c) => c.text),
      'passage'
    );
    for (let i = 0; i < chunks.length; i++) {
      chunks[i].embedding = vectors[i];
    }

    const document_id = generateDocumentId();
    const conversation_id = generateConversationId();
    const uploaded_at = Date.now();

    addDocument({
      document_id,
      filename: extracted.filename,
      page_count: extracted.pages.length,
      chunk_count: chunks.length,
      uploaded_at,
      chunks,
    });

    const elapsed = Date.now() - startedAt;
    console.log(
      JSON.stringify({
        event: 'upload',
        document_id,
        filename: extracted.filename,
        page_count: extracted.pages.length,
        chunk_count: chunks.length,
        elapsed_ms: elapsed,
        embedding_model: process.env.EMBEDDING_MODEL || 'BAAI/bge-small-en-v1.5',
      })
    );

    const body: UploadResponse = {
      document_id,
      filename: extracted.filename,
      page_count: extracted.pages.length,
      chunk_count: chunks.length,
      conversation_id,
      embedding_model: process.env.EMBEDDING_MODEL || 'BAAI/bge-small-en-v1.5',
      uploaded_at,
    };
    return res.status(200).json(body);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[upload] error:', msg);
    return res.status(500).json({ error: `Upload failed: ${msg}` });
  }
}

function sanitizeFilename(name: string): string {
  const stripped = name.replace(/[\r\n\\/:]/g, '_').trim();
  return stripped.length > 0 ? stripped : 'upload.pdf';
}
