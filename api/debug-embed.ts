import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const hfToken = process.env.HF_API_KEY;
  if (!hfToken) {
    return res.status(500).json({ error: 'HF_API_KEY not set' });
  }

  const MODEL_ID = 'BAAI/bge-small-en-v1.5';
  const API_URL = `https://router.huggingface.co/hf-inference/models/${MODEL_ID}`;

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${hfToken}`,
      },
      body: JSON.stringify({
        inputs: 'hello',
        options: { wait_for_model: true },
      }),
    });

    const text = await response.text();
    let parsed;
    try { parsed = JSON.parse(text); } catch { parsed = null; }

    return res.status(200).json({
      hf_status: response.status,
      response_type: typeof parsed,
      is_array: Array.isArray(parsed),
      first_element_type: Array.isArray(parsed) ? typeof parsed[0] : 'N/A',
      first_element_is_array: Array.isArray(parsed) ? Array.isArray(parsed[0]) : false,
      length: Array.isArray(parsed) ? parsed.length : 'N/A',
      nested_length: Array.isArray(parsed) && Array.isArray(parsed[0]) ? parsed[0].length : 'N/A',
      sample: Array.isArray(parsed) ? JSON.stringify(parsed).substring(0, 200) : text.substring(0, 200),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown';
    return res.status(500).json({ error: msg });
  }
}
