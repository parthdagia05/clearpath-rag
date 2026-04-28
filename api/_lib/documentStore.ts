import type { Chunk } from './types';

export interface StoredDocument {
  document_id: string;
  filename: string;
  page_count: number;
  chunk_count: number;
  uploaded_at: number;
  chunks: Chunk[];
}

const TTL_MS = 60 * 60 * 1000;
const MAX_DOCUMENTS = 50;

const documents = new Map<string, StoredDocument>();

export function generateDocumentId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = 'doc_';
  for (let i = 0; i < 12; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

export function addDocument(doc: StoredDocument): void {
  evictExpired();
  if (documents.size >= MAX_DOCUMENTS) {
    let oldestId: string | null = null;
    let oldestAt = Infinity;
    for (const [id, d] of documents) {
      if (d.uploaded_at < oldestAt) {
        oldestAt = d.uploaded_at;
        oldestId = id;
      }
    }
    if (oldestId) documents.delete(oldestId);
  }
  documents.set(doc.document_id, doc);
}

export function getDocument(documentId: string): StoredDocument | undefined {
  evictExpired();
  return documents.get(documentId);
}

export function hasDocument(documentId: string): boolean {
  evictExpired();
  return documents.has(documentId);
}

export function removeDocument(documentId: string): boolean {
  return documents.delete(documentId);
}

export function listDocuments(): Array<Omit<StoredDocument, 'chunks'>> {
  evictExpired();
  return Array.from(documents.values()).map((d) => ({
    document_id: d.document_id,
    filename: d.filename,
    page_count: d.page_count,
    chunk_count: d.chunk_count,
    uploaded_at: d.uploaded_at,
  }));
}

function evictExpired(): void {
  const now = Date.now();
  for (const [id, d] of documents) {
    if (now - d.uploaded_at > TTL_MS) documents.delete(id);
  }
}
