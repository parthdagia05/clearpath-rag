import axios from 'axios';
import type { QueryResponse, UploadResponse } from '../types';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
});

export async function uploadPdf(file: File): Promise<UploadResponse> {
  const buffer = await file.arrayBuffer();
  const res = await api.post<UploadResponse>('/upload', buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'X-Filename': file.name,
    },
    timeout: 120_000,
    transformRequest: [(data) => data],
  });
  return res.data;
}

export async function sendMessage(
  question: string,
  document_id: string,
  conversation_id?: string
): Promise<QueryResponse> {
  const body: { question: string; document_id: string; conversation_id?: string } = {
    question,
    document_id,
  };
  if (conversation_id) body.conversation_id = conversation_id;
  const res = await api.post<QueryResponse>('/query', body, { timeout: 60_000 });
  return res.data;
}

export async function deleteDocument(document_id: string): Promise<void> {
  await api.delete(`/documents?document_id=${encodeURIComponent(document_id)}`);
}

export default api;
