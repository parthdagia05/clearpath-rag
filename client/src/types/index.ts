// src/types/index.ts
// Shared frontend types

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface DebugInfo {
  model: string;
  tokensUsed: number;
  latencyMs: number;
  evaluatorFlag: string;
}

export interface ChatResponse {
  reply: string;
  debug: DebugInfo;
}
