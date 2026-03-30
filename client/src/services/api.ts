// src/services/api.ts
// Axios wrapper for backend API calls

import axios from 'axios';
import type { QueryResponse } from '../types';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Send a question to POST /query.
 */
export async function sendMessage(
  question: string,
  conversationId?: string
): Promise<QueryResponse> {
  const body: { question: string; conversation_id?: string } = { question };
  if (conversationId) {
    body.conversation_id = conversationId;
  }
  const res = await api.post<QueryResponse>('/query', body);
  return res.data;
}

export default api;
