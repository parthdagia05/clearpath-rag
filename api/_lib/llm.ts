import axios from 'axios';
import type { ChatTurn } from './conversationStore';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

export interface LlmResponse {
  answer: string;
  tokens_input: number;
  tokens_output: number;
}

export async function callGroq(
  model: string,
  systemPrompt: string,
  history: ChatTurn[],
  userPrompt: string
): Promise<LlmResponse> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || apiKey === 'your_groq_api_key_here') {
    throw new Error('GROQ_API_KEY is not configured.');
  }

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.map((t) => ({ role: t.role, content: t.content })),
    { role: 'user', content: userPrompt },
  ];

  const response = await axios.post(
    GROQ_API_URL,
    {
      model,
      messages,
      temperature: 0.1,
      max_tokens: 1024,
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 30_000,
    }
  );

  const data = response.data;
  return {
    answer: data.choices?.[0]?.message?.content ?? '',
    tokens_input: data.usage?.prompt_tokens ?? 0,
    tokens_output: data.usage?.completion_tokens ?? 0,
  };
}
