/**
 * The open-source AI core of Remember.
 *
 * We run sentence-transformers/all-MiniLM-L6-v2 (Apache-2.0, open weights)
 * directly inside this Node process via ONNX Runtime. There is no inference
 * API, no vendor account and no token metering: the model is downloaded once
 * into DATA_DIR/model-cache and after that everything runs offline.
 *
 * That choice is the whole point. These embeddings are computed over somebody's
 * most private memories — a breakup, a funeral, a relapse, a childhood bedroom.
 * Open weights mean that text is vectorised on hardware the user controls and
 * never crosses a network boundary it did not have to cross.
 */

import crypto from 'node:crypto';
import { paths } from '../paths.js';

export const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'Xenova/all-MiniLM-L6-v2';

let pipelinePromise = null;
let status = { state: 'idle', model: EMBEDDING_MODEL, error: null };

export function embeddingStatus() {
  return { ...status };
}

async function getPipeline() {
  if (pipelinePromise) return pipelinePromise;

  status = { state: 'loading', model: EMBEDDING_MODEL, error: null };
  pipelinePromise = (async () => {
    const { pipeline, env } = await import('@huggingface/transformers');
    // Keep every byte of the model on our own disk.
    env.cacheDir = paths.modelCache;
    env.allowLocalModels = true;
    const extractor = await pipeline('feature-extraction', EMBEDDING_MODEL, {
      dtype: 'q8', // int8 weights: ~23MB, comfortable on a small Render instance
    });
    status = { state: 'ready', model: EMBEDDING_MODEL, error: null };
    return extractor;
  })().catch((err) => {
    status = { state: 'unavailable', model: EMBEDDING_MODEL, error: err.message };
    pipelinePromise = null;
    throw err;
  });

  return pipelinePromise;
}

/** Warm the model at boot so the first reflection isn't the slow one. */
export function warmUp() {
  getPipeline()
    .then(() => embed('warm up'))
    .then(() => console.log(`[ai] ${EMBEDDING_MODEL} ready (local inference)`))
    .catch((err) => console.warn(`[ai] embeddings unavailable: ${err.message}`));
}

/** @returns {Promise<number[]>} a unit-length 384-d vector */
export async function embed(text) {
  const extractor = await getPipeline();
  const output = await extractor(String(text || '').slice(0, 4000), {
    pooling: 'mean',
    normalize: true,
  });
  return Array.from(output.data);
}

export async function embedMany(texts) {
  const out = [];
  for (const t of texts) out.push(await embed(t));
  return out;
}

export function cosine(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot; // vectors are already normalized
}

export function centroid(vectors) {
  if (!vectors.length) return null;
  const dims = vectors[0].length;
  const sum = new Float64Array(dims);
  for (const v of vectors) for (let i = 0; i < dims; i++) sum[i] += v[i];
  let norm = 0;
  for (let i = 0; i < dims; i++) {
    sum[i] /= vectors.length;
    norm += sum[i] * sum[i];
  }
  norm = Math.sqrt(norm) || 1;
  return Array.from(sum, (x) => x / norm);
}

/**
 * The text we actually embed for a memory. Changing this changes the hash,
 * which is how we know to recompute a vector after an edit.
 */
export function memorySourceText(memory) {
  return [
    memory.title,
    memory.memory_text,
    memory.meaning,
    (memory.people || []).join(', '),
    memory.place,
    memory.category,
    memory.feeling,
    (memory.tags || []).join(', '),
  ]
    .filter(Boolean)
    .join('\n');
}

export function sourceHash(memory) {
  return crypto.createHash('sha1').update(memorySourceText(memory)).digest('hex');
}
