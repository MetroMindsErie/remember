/**
 * The reflection engine.
 *
 * Everything in here is derived from the user's own memories plus the local
 * embedding model. There are three layers:
 *
 *   1. Signals   — structured facts: people, places, feelings, chapters, and
 *                  value scores from the anchor prototypes.
 *   2. Retrieval — semantic search over memory vectors, so "what did I survive"
 *                  finds the right memories without sharing a single keyword.
 *   3. Prose     — a deterministic composer turns signals into warm, grounded
 *                  text. If an open-weight LLM is configured it rewrites that
 *                  text; if not, the composer's output ships as-is.
 *
 * Layer 3 is deliberately the thin one. The app is useful with no LLM at all.
 */

import {
  embed, cosine, centroid, memorySourceText, sourceHash,
  EMBEDDING_MODEL, embeddingStatus,
} from './embeddings.js';
import {
  VALUE_ANCHORS, STORY_LENSES, FEELING_TONE, HARD_FEELINGS, HARD_CATEGORIES,
} from './anchors.js';
import {
  listMemories as listMemoryRows, getEmbeddingMap, saveEmbedding, db, attachmentMap,
} from '../db.js';

/**
 * Memories with their attachments joined on. Everything in this module reads
 * through here so captions are part of the text we embed and search.
 */
function listMemories() {
  const byMemory = attachmentMap();
  return listMemoryRows().map((m) => ({ ...m, attachments: byMemory.get(m.id) ?? [] }));
}
import { chapterFor } from '../timeperiod.js';

/* ------------------------------------------------------------------ anchors */

let anchorCache = null;

async function anchorPrototypes() {
  if (anchorCache) return anchorCache;
  const protos = [];
  for (const a of VALUE_ANCHORS) {
    const vecs = [];
    for (const ex of a.examples) vecs.push(await embed(ex));
    protos.push({ id: a.id, label: a.label, vector: centroid(vecs) });
  }
  anchorCache = protos;
  return protos;
}

let lensCache = null;

async function lensVectors() {
  if (lensCache) return lensCache;
  const out = new Map();
  for (const lens of STORY_LENSES) out.set(lens.id, await embed(lens.query));
  lensCache = out;
  return out;
}

/**
 * Scores a vector against every value anchor, then z-scores across anchors.
 * The centering is what makes this work: raw cosine against a small model is
 * dominated by a generic "is this English prose" component that is identical
 * for every anchor. Subtracting the per-memory mean removes it and leaves the
 * actual signal.
 */
function scoreAnchors(vector, protos) {
  const raw = protos.map((p) => ({ id: p.id, label: p.label, score: cosine(vector, p.vector) }));
  const mean = raw.reduce((s, r) => s + r.score, 0) / raw.length;
  const sd = Math.sqrt(raw.reduce((s, r) => s + (r.score - mean) ** 2, 0) / raw.length) || 1;
  return raw
    .map((r) => ({ ...r, z: (r.score - mean) / sd }))
    .sort((a, b) => b.z - a.z);
}

/* -------------------------------------------------------------- embeddings */

/** Computes any missing or stale memory vectors. Safe to call often. */
export async function ensureEmbeddings({ onlyId = null } = {}) {
  const memories = onlyId
    ? listMemories().filter((m) => m.id === onlyId)
    : listMemories();
  const existing = getEmbeddingMap();
  const stale = memories.filter((m) => {
    const e = existing.get(m.id);
    return !e || e.model !== EMBEDDING_MODEL || e.sourceHash !== sourceHash(m);
  });
  if (!stale.length) return { embedded: 0, total: memories.length };

  for (const m of stale) {
    const vector = await embed(memorySourceText(m));
    saveEmbedding(m.id, {
      model: EMBEDDING_MODEL,
      dims: vector.length,
      vector,
      sourceHash: sourceHash(m),
    });
  }
  return { embedded: stale.length, total: memories.length };
}

/* ------------------------------------------------------------------ signals */

const NAME_STOPWORDS = new Set([
  'me', 'myself', 'i', 'mine', 'everyone', 'everybody', 'people', 'family',
  'friends', 'them', 'us', 'we', 'nobody', 'no one', 'alone',
]);

function normalizePerson(name) {
  const t = String(name || '').trim().replace(/\s+/g, ' ');
  if (!t) return null;
  if (NAME_STOPWORDS.has(t.toLowerCase())) return null;
  return t;
}

function tally(items) {
  const map = new Map();
  for (const raw of items) {
    if (!raw) continue;
    const key = String(raw).trim();
    if (!key) continue;
    const k = key.toLowerCase();
    const prev = map.get(k) || { label: key, count: 0 };
    prev.count += 1;
    map.set(k, prev);
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/**
 * Builds the full structured signal set. This is the single source of truth
 * for Insights, Remind Me Who I Am and Explore My Story, so all three agree.
 */
export async function buildSignals() {
  const memories = listMemories();
  const total = memories.length;

  const base = {
    total,
    hasEnough: total >= 1,
    people: [], places: [], tags: [], categories: [], feelings: [],
    chapters: [], values: [], achievements: [], challenges: [],
    media: { photos: 0, music: 0, video: 0, links: 0 },
    arc: { positive: 0, hard: 0, neutral: 0, ratio: 0 },
    ai: { ...embeddingStatus(), vectors: 0 },
  };
  if (!total) return base;

  const people = tally(memories.flatMap((m) => (m.people || []).map(normalizePerson).filter(Boolean)));
  const places = tally(memories.map((m) => m.place).filter(Boolean));
  const tags = tally(memories.flatMap((m) => m.tags || []));
  const categories = tally(memories.map((m) => m.category));
  const feelings = tally(memories.map((m) => m.feeling));
  const chapters = tally(memories.map((m) => chapterFor(m.time_sort, m.time_period)));

  const media = {
    photos: memories.filter((m) => m.photo_url).length,
    music: memories.filter((m) => m.music_url).length,
    video: memories.filter((m) => m.video_url).length,
    links: memories.filter((m) => m.attachment_url).length,
  };

  // "Hard" has to mean one thing across the whole app. A memory counts as hard
  // if its category or its feeling says so — the same test the challenges list
  // uses — otherwise the reminder can say "2 hard things" and "1 heavy one" in
  // consecutive paragraphs, which instantly destroys trust in the reflection.
  const isHard = (m) => HARD_CATEGORIES.includes(m.category) || HARD_FEELINGS.includes(m.feeling);
  let positive = 0, hard = 0, neutral = 0;
  for (const m of memories) {
    if (isHard(m)) hard += 1;
    else if ((FEELING_TONE[m.feeling] ?? 0) > 0) positive += 1;
    else neutral += 1;
  }

  const achievements = memories
    .filter((m) => m.category === 'Achievement' || ['Proud', 'Strong'].includes(m.feeling))
    .slice(0, 12);

  const challenges = memories.filter(isHard).slice(0, 12);

  // Chronological span. `chapters` is ranked by frequency, so it cannot be used
  // to say "from X to Y" — we need the actual earliest and latest dated memory.
  const dated = memories.filter((m) => m.time_sort != null).sort((a, b) => a.time_sort - b.time_sort);
  const span = dated.length
    ? {
        earliest: chapterFor(dated[0].time_sort, dated[0].time_period),
        latest: chapterFor(dated[dated.length - 1].time_sort, dated[dated.length - 1].time_period),
        dated: dated.length,
      }
    : null;

  const signals = {
    ...base,
    people, places, tags, categories, feelings, chapters, media, span,
    achievements, challenges,
    arc: { positive, hard, neutral, ratio: total ? positive / total : 0 },
  };

  // --- the AI layer: value themes from the embedding model ---
  try {
    await ensureEmbeddings();
    const protos = await anchorPrototypes();
    const vecs = getEmbeddingMap();
    const usable = memories.map((m) => vecs.get(m.id)?.vector).filter(Boolean);
    signals.ai = { ...embeddingStatus(), vectors: usable.length };

    if (usable.length) {
      // Per-memory value scores, averaged — more robust than scoring the
      // single centroid, which washes out a person with varied memories.
      const accum = new Map(protos.map((p) => [p.id, { label: p.label, total: 0, top: 0 }]));
      for (const v of usable) {
        const scored = scoreAnchors(v, protos);
        for (const s of scored) {
          const a = accum.get(s.id);
          a.total += s.z;
        }
        for (const s of scored.slice(0, 3)) accum.get(s.id).top += 1;
      }
      signals.values = [...accum.entries()]
        .map(([id, a]) => ({
          id,
          label: a.label,
          strength: a.total / usable.length,
          memories: a.top,
        }))
        // A value must both score well on average AND actually lead in at least
        // one memory. Average alone let themes through that were never the top
        // read of anything, which surfaced as "Loyalty — 0 memories".
        .filter((v) => v.strength > 0.15 && v.memories > 0)
        .sort((a, b) => b.strength - a.strength)
        .slice(0, 8);
      signals.identityVector = centroid(usable);
    }
  } catch (err) {
    signals.ai = { ...embeddingStatus(), vectors: 0, error: err.message };
  }

  return signals;
}

/* ---------------------------------------------------------------- retrieval */

/**
 * Words that carry no retrieval signal. Without this list a query like
 * "people who took care of me" scores highly against any memory containing
 * "took" or "me", which is nearly all of them, and the keyword component
 * drowns out the embedding entirely.
 */
const SEARCH_STOPWORDS = new Set([
  'the','a','an','and','or','but','if','then','than','that','this','these','those',
  'i','me','my','mine','myself','you','your','we','us','our','they','them','their',
  'he','she','his','her','it','its','who','whom','whose','what','which','when','where',
  'why','how','was','were','is','are','am','be','been','being','do','did','does','done',
  'have','has','had','will','would','can','could','should','may','might','must',
  'of','in','on','at','to','for','from','with','about','into','over','after','before',
  'up','down','out','off','again','very','just','some','any','all','one','two',
  'thing','things','like','got','get','went','go','still','back','time','times',
]);

/**
 * Semantic search.
 *
 * The embedding is the primary signal — that is the whole reason this app runs
 * a model at all. "What did I survive" has to find a memory about a hospital
 * room without sharing a single word with it. Keyword matching is kept only as
 * a *boost*, for the cases vectors are bad at: proper nouns the model has never
 * seen ("Nana", "Topeka", "Mr. Alvarez"). It also means search degrades to
 * plain text matching rather than breaking if the model is unavailable.
 */
export async function semanticSearch(query, { limit = 20 } = {}) {
  const memories = listMemories();
  const q = String(query || '').trim();
  if (!q) return memories.map((m) => ({ memory: m, score: 0, matchedOn: 'all' }));

  const lower = q.toLowerCase();
  const terms = [...new Set(
    lower.split(/[^a-z0-9']+/).filter((t) => t.length > 2 && !SEARCH_STOPWORDS.has(t))
  )];

  /** Fraction of the query's *content* words present, weighted toward rarer ones. */
  const keywordScore = (m) => {
    const hay = memorySourceText(m).toLowerCase();
    if (!hay) return 0;
    if (!terms.length) return hay.includes(lower) ? 1 : 0;
    let hits = 0;
    for (const t of terms) {
      if (hay.includes(t)) hits += 1;
      // A capitalised term that matches is almost certainly a name or place:
      // treat that as a strong signal rather than one term among many.
      else continue;
    }
    const frac = hits / terms.length;
    const looksLikeName = /[A-Z]/.test(q.slice(1)) || terms.some((t) => t.length > 7);
    return looksLikeName ? Math.min(1, frac * 1.3) : frac;
  };

  let vectorScores = new Map();
  let modelAvailable = false;
  try {
    await ensureEmbeddings();
    const qv = await embed(q);
    const vecs = getEmbeddingMap();
    for (const m of memories) {
      const e = vecs.get(m.id);
      if (e) vectorScores.set(m.id, cosine(qv, e.vector));
    }
    modelAvailable = vectorScores.size > 0;
  } catch {
    // No model: fall through to keyword-only.
  }

  const scored = memories.map((m) => {
    const kw = keywordScore(m);
    const vec = vectorScores.get(m.id) ?? 0;
    // Vector leads. Keyword adds up to ~0.3, enough to pull an exact-name match
    // to the top but never enough to float an unrelated memory on stopwords.
    const score = modelAvailable ? vec + kw * 0.3 : kw;
    return {
      memory: m,
      score,
      matchedOn: kw >= 0.5 && vec >= 0.25 ? 'both' : kw >= 0.5 ? 'name' : 'meaning',
    };
  });

  // Relative threshold: keep what is close to the best hit rather than using a
  // fixed cutoff, since cosine ranges shift with query length.
  const best = Math.max(...scored.map((s) => s.score), 0);
  const floor = modelAvailable ? Math.max(0.18, best * 0.55) : 0.1;

  return scored
    .filter((s) => s.score >= floor)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/** Ranks memories against one of the Explore lenses. */
async function rankByLens(lensId, { limit = 8 } = {}) {
  const memories = listMemories();
  if (!memories.length) return [];
  try {
    await ensureEmbeddings();
    const lv = (await lensVectors()).get(lensId);
    const vecs = getEmbeddingMap();
    return memories
      .map((m) => ({ memory: m, score: vecs.get(m.id) ? cosine(lv, vecs.get(m.id).vector) : 0 }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  } catch {
    return memories.slice(0, limit).map((m) => ({ memory: m, score: 0 }));
  }
}

export { rankByLens, anchorPrototypes, scoreAnchors };
