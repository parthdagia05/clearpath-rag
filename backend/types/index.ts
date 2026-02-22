// types/index.ts
// Shared TypeScript types and interfaces for ClearPath

export interface ChatRequest {
  message: string;
  sessionId?: string;
}

export interface ChatResponse {
  reply: string;
  retrievedChunksCount: number;
  topScore: number;
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

// --- POST /query API contract types ---

export interface QueryRequest {
  question: string;
  conversation_id?: string;
}

export interface Source {
  document: string;
  page: number | null;
  relevance_score: number;
}

export interface QueryMetadata {
  model_used: string;
  classification: string;
  tokens: {
    input: number;
    output: number;
  };
  latency_ms: number;
  chunks_retrieved: number;
  evaluator_flags: string[];
}

export interface QueryResponse {
  answer: string;
  metadata: QueryMetadata;
  sources: Source[];
  conversation_id: string;
}

