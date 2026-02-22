// src/types/index.ts
// Shared frontend types matching POST /query API contract

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
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
