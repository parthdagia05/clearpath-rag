export interface VectorSearchResult {
  id: string;
  content: string;
  score: number;
  document_name: string;
  page_number: number | null;
}

export interface Chunk {
  chunk_id: string;
  document_name: string;
  page_number: number | null;
  text: string;
  embedding?: number[];
}

export interface Source {
  document: string;
  page: number | null;
  relevance_score: number;
}

export interface QueryMetadata {
  model_used: string;
  classification: string;
  tokens: { input: number; output: number };
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
