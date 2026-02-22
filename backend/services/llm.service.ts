// services/llm.service.ts
// Groq API integration via Axios
// Models:
//   - llama-3.1-8b-instant   (simple queries)
//   - llama-3.3-70b-versatile (complex queries)

import axios from 'axios';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

export interface LlmResponse {
  answer: string;
  tokens_input: number;
  tokens_output: number;
}

/**
 * Call the Groq chat completion API.
 *
 * @param model       - Groq model ID (e.g. "llama-3.1-8b-instant")
 * @param systemPrompt - System message content
 * @param userPrompt   - User message content
 * @returns LlmResponse with answer text and token usage
 */
export async function callGroq(
  model: string,
  systemPrompt: string,
  userPrompt: string
): Promise<LlmResponse> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || apiKey === 'your_groq_api_key_here') {
    throw new Error('GROQ_API_KEY is not configured. Set it in the .env file.');
  }

  const response = await axios.post(
    GROQ_API_URL,
    {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
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
  const answer = data.choices?.[0]?.message?.content ?? '';
  const tokens_input = data.usage?.prompt_tokens ?? 0;
  const tokens_output = data.usage?.completion_tokens ?? 0;

  return { answer, tokens_input, tokens_output };
}
