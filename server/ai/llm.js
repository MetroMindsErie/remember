/**
 * Optional open-weight LLM polish.
 *
 * Remember never *requires* this. The composer already produces the full
 * reflection; an LLM only rewrites it in warmer prose. We talk to it over the
 * OpenAI-compatible chat-completions shape, which is the de-facto standard that
 * every open-weight serving stack speaks — Ollama, llama.cpp's server, vLLM,
 * TGI, Together, Groq, Fireworks, OpenRouter.
 *
 * The practical consequence: you point BASE_URL at localhost and run
 * Qwen2.5-7B-Instruct on your own machine, and the private memories in this
 * app never leave it. That option does not exist with a closed API. If the
 * endpoint is slow, down, or not configured, we fall through to the composer
 * and the user never sees an error.
 */

const BASE_URL = (process.env.OPEN_MODEL_BASE_URL || '').replace(/\/+$/, '');
const MODEL = process.env.OPEN_MODEL_NAME || '';
const API_KEY = process.env.OPEN_MODEL_API_KEY || '';
const TIMEOUT_MS = Number(process.env.OPEN_MODEL_TIMEOUT_MS || 25000);

export function llmStatus() {
  return {
    configured: Boolean(BASE_URL && MODEL),
    model: MODEL || null,
    endpoint: BASE_URL ? new URL(BASE_URL).host : null,
    local: BASE_URL ? /^(localhost|127\.0\.0\.1|\[::1\]|host\.docker\.internal)/.test(new URL(BASE_URL).host) : false,
  };
}

const SYSTEM = `You are the reflection voice of Remember, a private memory app.

You will be given (a) structured facts drawn from one person's own saved memories and (b) a draft reflection already written from those facts. Rewrite the draft so it reads warmer and more human.

Hard rules:
- Use ONLY the facts provided. Never invent a person, place, event, date or feeling that is not there.
- Address the person as "you". Never use their name unless it appears in the facts.
- Be specific. Name the actual people, places and memory titles you were given. Specificity is the entire point; generic affirmation is worse than nothing.
- Warm and grounding, never clinical, never therapeutic-boilerplate, never saccharine. No emoji. No bullet lists.
- Do not minimise hard things or rush to a silver lining. Acknowledge weight, then point at evidence of survival.
- Never give medical, clinical or crisis advice.
- 4 to 6 short paragraphs. Plain prose. Return the rewritten reflection only, with no preamble.`;

async function chat(messages, { maxTokens = 900, temperature = 0.7 } = {}) {
  if (!BASE_URL || !MODEL) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {}),
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: false,
      }),
    });
    if (!res.ok) {
      console.warn(`[llm] ${res.status} from ${BASE_URL} — falling back to composer`);
      return null;
    }
    const json = await res.json();
    const text = json?.choices?.[0]?.message?.content;
    return typeof text === 'string' && text.trim() ? text.trim() : null;
  } catch (err) {
    console.warn(`[llm] ${err.name === 'AbortError' ? 'timed out' : err.message} — falling back to composer`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Compact, token-cheap view of the signals for the prompt. */
function factSheet(signals) {
  const lines = [];
  lines.push(`Memories saved: ${signals.total}`);
  if (signals.people?.length) lines.push(`People (with mention counts): ${signals.people.slice(0, 8).map((p) => `${p.label} x${p.count}`).join(', ')}`);
  if (signals.places?.length) lines.push(`Places: ${signals.places.slice(0, 8).map((p) => p.label).join(', ')}`);
  if (signals.chapters?.length) lines.push(`Life chapters represented: ${signals.chapters.map((c) => `${c.label} (${c.count})`).join(', ')}`);
  if (signals.feelings?.length) lines.push(`Feelings recorded: ${signals.feelings.map((f) => `${f.label} x${f.count}`).join(', ')}`);
  if (signals.values?.length) lines.push(`Value themes detected by the local embedding model: ${signals.values.map((v) => v.label).join(', ')}`);
  if (signals.achievements?.length) lines.push(`Memories they were proud of: ${signals.achievements.map((a) => a.title).join('; ')}`);
  if (signals.challenges?.length) lines.push(`Hard things they came through: ${signals.challenges.map((c) => c.title).join('; ')}`);
  if (signals.tags?.length) lines.push(`Tags: ${signals.tags.slice(0, 10).map((t) => t.label).join(', ')}`);
  return lines.join('\n');
}

/** Rewrites a reminder. Returns null when unavailable — callers keep the draft. */
export async function polishReminder(signals, draft) {
  if (!llmStatus().configured || signals.total === 0) return null;
  const text = await chat([
    { role: 'system', content: SYSTEM },
    {
      role: 'user',
      content: `FACTS FROM THEIR MEMORIES:\n${factSheet(signals)}\n\nDRAFT REFLECTION:\n${draft.paragraphs.join('\n\n')}\n\nRewrite the draft.`,
    },
  ]);
  if (!text) return null;
  return {
    ...draft,
    paragraphs: text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean),
    polishedBy: MODEL,
  };
}

/** Rewrites an Explore section. Keeps the markdown-ish **bold** headers. */
export async function polishStory(lens, signals, draft) {
  if (!llmStatus().configured || draft.empty) return null;
  const text = await chat([
    {
      role: 'system',
      content: `${SYSTEM}\n\nYou are rewriting the section titled "${lens.label}". Keep any **bold lead-ins** that the draft uses. 3 to 6 paragraphs.`,
    },
    {
      role: 'user',
      content: `FACTS FROM THEIR MEMORIES:\n${factSheet(signals)}\n\nDRAFT SECTION:\n${draft.paragraphs.join('\n\n')}\n\nRewrite the draft.`,
    },
  ], { maxTokens: 800 });
  if (!text) return null;
  return {
    ...draft,
    paragraphs: text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean),
    polishedBy: MODEL,
  };
}
