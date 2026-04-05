// Vercel Edge Function — Gemini proxy
// Keeps the API key server-side. Client sends messages + systemPrompt;
// this function calls Gemini and re-streams as simple SSE.
//
// Key resolution order:
//   1. X-User-Api-Key request header  (BYOK — user's own free Gemini key)
//   2. GEMINI_API_KEY environment variable  (developer's key, set in Vercel dashboard)
//
// Get a free Gemini API key at: https://aistudio.google.com

export const config = { runtime: 'edge' };

const GEMINI_MODEL  = 'gemini-1.5-flash';
const GEMINI_URL    = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:streamGenerateContent?alt=sse`;
const MAX_OUT_TOKENS = 512;

export default async function handler(req) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(),
    });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  // Key resolution
  const apiKey =
    req.headers.get('x-user-api-key') ||
    process.env.GEMINI_API_KEY ||
    null;

  if (!apiKey) {
    return json(
      { error: 'No AI key configured. Set GEMINI_API_KEY in Vercel, or add your own key in Settings.' },
      503
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const { messages = [], systemPrompt = '' } = body;

  // Map from our format → Gemini format
  // Our roles: 'user' | 'assistant'
  // Gemini roles: 'user' | 'model'
  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const geminiBody = {
    system_instruction: systemPrompt
      ? { parts: [{ text: systemPrompt }] }
      : undefined,
    contents,
    generationConfig: {
      maxOutputTokens: MAX_OUT_TOKENS,
      temperature: 0.7,
    },
  };

  // Remove system_instruction key if empty (Gemini rejects empty object)
  if (!geminiBody.system_instruction) delete geminiBody.system_instruction;

  let geminiRes;
  try {
    geminiRes = await fetch(GEMINI_URL, {
      method:  'POST',
      headers: {
        'Content-Type':   'application/json',
        'x-goog-api-key': apiKey,
      },
      body:    JSON.stringify(geminiBody),
    });
  } catch (err) {
    return json({ error: 'Failed to reach Gemini API' }, 502);
  }

  if (!geminiRes.ok) {
    const errText = await geminiRes.text().catch(() => '');
    const status  = geminiRes.status === 400 ? 400
                  : geminiRes.status === 401 ? 401
                  : geminiRes.status === 429 ? 429
                  : 502;
    return json({ error: `Gemini error ${geminiRes.status}: ${errText.slice(0, 200)}` }, status);
  }

  // Re-stream Gemini SSE as our simple { "text": "..." } SSE format
  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      const reader = geminiRes.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop(); // keep incomplete last line

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const raw = line.slice(6).trim();
            if (!raw || raw === '[DONE]') continue;

            let parsed;
            try { parsed = JSON.parse(raw); } catch { continue; }

            // Extract text delta from Gemini response structure
            const text =
              parsed?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

            if (text) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ text })}\n\n`)
              );
            }
          }
        }
      } catch {
        // stream interrupted — send whatever we have
      }

      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });

  return new Response(readable, {
    status: 200,
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection':    'keep-alive',
      ...corsHeaders(),
    },
  });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-User-Api-Key',
  };
}
