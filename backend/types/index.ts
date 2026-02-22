// types/index.ts
// Shared TypeScript types and interfaces for ClearPath

export interface ChatRequest {
  message: string;
  sessionId?: string;
}

export interface ChatResponse {
  reply: string;
  debug: DebugInfo;
}

export interface DebugInfo {
  model: string;
  tokensUsed: number;
  latencyMs: number;
  evaluatorFlag: string;
}

export interface EmbeddingVector {
  id: string;
  content: string;
  vector: number[];
  metadata?: Record<string, unknown>;
}

export interface VectorSearchResult {
  id: string;
  content: string;
  score: number;
  document_name: string;
  page_number: number | null;
}

// --- Document ingestion types ---

export interface ExtractedPage {
  pageNumber: number;
  text: string;
}

export interface ExtractedDocument {
  name: string;
  pages: ExtractedPage[];
  fullText: string;
}

export interface Chunk {
  chunk_id: string;
  document_name: string;
  page_number: number | null;
  text: string;
  embedding?: number[];
}
