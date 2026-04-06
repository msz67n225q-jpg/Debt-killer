// Vercel Edge Function — Gemini proxy
// Keeps the API key server-side. Client sends messages array;
// the system instruction is hard-coded here and cannot be overridden by callers.
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

// Server-side system instruction — clients cannot override this
const SYSTEM_STUB = 'You are a helpful debt payoff advisor. Be concise (2–4 sentences), specific, and actionable. Mobile-friendly responses only.';

// Allowed CORS origin — set ALLOWED_ORIGIN env var in Vercel for custom domains
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://debt-killer.vercel.app';

const VALID_ROLES = new Set(['user', 'assistant']);

// Generic error messages — do not expose internal API details to clients
const ERROR_MSG = {
  400: 'Invalid request',
  401: 'AI key invalid or expired — check your key in Settings',
  429: 'AI rate limit reached — try again shortly',
  503: 'AI service unavailable',
};

export default async function handler(req) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405, req);
  }

  // Key resolution
  const apiKey =
    req.headers.get('x-user-api-key') ||
    process.env.GEMINI_API_KEY ||
    null;

  if (!apiKey) {
    return json(
      { error: 'No AI key configured. Set GEMINI_API_KEY in Vercel, or add your own key in Settings.' },
      503, req
    );
  }

  // Read body as text first — enforce size limit before parsing
  let raw;
  try { raw = await req.text(); }
  catch { return json({ error: 'Could not read request body' }, 400, req); }

  if (raw.length > 100_000) {
    return json({ error: 'Payload too large' }, 413, req);
  }

  let body;
  try { body = JSON.parse(raw); }
  catch { return json({ error: 'Invalid JSON body' }, 400, req); }

  const { messages = [] } = body;

  // Validate and sanitize message objects
  const safeMessages = messages
    .filter(m =>
      VALID_ROLES.has(m?.role) &&
      typeof m?.content === 'string' &&
      m.content.trim().length > 0
    )
    .map(m => ({
      role:    m.role,
      content: String(m.content).slice(0, 4000),
    }));

  if (!safeMessages.length) {
    return json({ error: 'No valid messages provided' }, 400, req);
  }

  // Map from our format → Gemini format
  // Our roles: 'user' | 'assistant'
  // Gemini roles: 'user' | 'model'
  const contents = safeMessages.map(m => ({
    role:  m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const geminiBody = {
    system_instruction: { parts: [{ text: SYSTEM_STUB }] },
    contents,
    generationConfig: {
      maxOutputTokens: MAX_OUT_TOKENS,
      temperature: 0.7,
    },
  };

  let geminiRes;
  try {
    geminiRes = await fetch(GEMINI_URL, {
      method:  'POST',
      headers: {
        'Content-Type':   'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify(geminiBody),
    });
  } catch {
    return json({ error: 'Failed to reach AI service' }, 502, req);
  }

  if (!geminiRes.ok) {
    const status = [400, 401, 429, 503].includes(geminiRes.status)
      ? geminiRes.status : 502;
    return json({ error: ERROR_MSG[status] || 'AI request failed' }, status, req);
  }

  // Re-stream Gemini SSE as our simple { "text": "..." } SSE format
  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      const reader  = geminiRes.body.getReader();
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

            const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
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
      ...corsHeaders(req),
    },
  });
}

function json(obj, status = 200, req) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(req) },
  });
}

function corsHeaders(req) {
  // Echo back the requesting origin if it matches the allowed origin,
  // otherwise return the static allowed origin (fails cross-origin check in browser).
  const origin = req?.headers?.get('origin') || '';
  const allow  = origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN;
  return {
    'Access-Control-Allow-Origin':  allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-User-Api-Key',
  };
}
