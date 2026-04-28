export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface Source {
  document: string;
  page: number | null;
  relevance_score: number;
  excerpt: string;
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
  refused: boolean;
}

export interface QueryResponse {
  answer: string;
  metadata: QueryMetadata;
  sources: Source[];
  conversation_id: string;
  document_id: string;
}

export interface UploadResponse {
  document_id: string;
  filename: string;
  page_count: number;
  chunk_count: number;
  conversation_id: string;
  embedding_model: string;
  uploaded_at: number;
}
