import Database from 'better-sqlite3';
import { paths, ensureDirs } from './paths.js';

ensureDirs();

export const db = new Database(paths.db);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS memories (
    id             TEXT PRIMARY KEY,
    created_at     TEXT NOT NULL,
    updated_at     TEXT NOT NULL,
    title          TEXT NOT NULL,
    memory_text    TEXT NOT NULL DEFAULT '',
    people         TEXT NOT NULL DEFAULT '[]',
    place          TEXT NOT NULL DEFAULT '',
    time_period    TEXT NOT NULL DEFAULT '',
    time_sort      REAL,
    category       TEXT NOT NULL DEFAULT 'Other',
    feeling        TEXT NOT NULL DEFAULT 'Nostalgic',
    meaning        TEXT NOT NULL DEFAULT '',
    photo_url      TEXT NOT NULL DEFAULT '',
    video_url      TEXT NOT NULL DEFAULT '',
    music_url      TEXT NOT NULL DEFAULT '',
    attachment_url TEXT NOT NULL DEFAULT '',
    tags           TEXT NOT NULL DEFAULT '[]',
    prompt         TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS embeddings (
    memory_id  TEXT PRIMARY KEY REFERENCES memories(id) ON DELETE CASCADE,
    model      TEXT NOT NULL,
    dims       INTEGER NOT NULL,
    vector     BLOB NOT NULL,
    source_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_memories_time_sort ON memories(time_sort);
  CREATE INDEX IF NOT EXISTS idx_memories_category  ON memories(category);
  CREATE INDEX IF NOT EXISTS idx_memories_feeling   ON memories(feeling);
`);

const JSON_FIELDS = ['people', 'tags'];

export function rowToMemory(row) {
  if (!row) return null;
  const out = { ...row };
  for (const f of JSON_FIELDS) {
    try {
      out[f] = JSON.parse(row[f] ?? '[]');
    } catch {
      out[f] = [];
    }
  }
  return out;
}

export function listMemories() {
  return db.prepare('SELECT * FROM memories').all().map(rowToMemory);
}

export function getMemory(id) {
  return rowToMemory(db.prepare('SELECT * FROM memories WHERE id = ?').get(id));
}

export function saveEmbedding(memoryId, { model, dims, vector, sourceHash }) {
  const buf = Buffer.from(new Float32Array(vector).buffer);
  db.prepare(
    `INSERT INTO embeddings (memory_id, model, dims, vector, source_hash, created_at)
     VALUES (@memory_id, @model, @dims, @vector, @source_hash, @created_at)
     ON CONFLICT(memory_id) DO UPDATE SET
       model = @model, dims = @dims, vector = @vector,
       source_hash = @source_hash, created_at = @created_at`
  ).run({
    memory_id: memoryId,
    model,
    dims,
    vector: buf,
    source_hash: sourceHash,
    created_at: new Date().toISOString(),
  });
}

export function getEmbeddings() {
  return db.prepare('SELECT * FROM embeddings').all().map((r) => ({
    memoryId: r.memory_id,
    model: r.model,
    dims: r.dims,
    sourceHash: r.source_hash,
    vector: Array.from(
      new Float32Array(r.vector.buffer, r.vector.byteOffset, r.dims)
    ),
  }));
}

export function getEmbeddingMap() {
  const map = new Map();
  for (const e of getEmbeddings()) map.set(e.memoryId, e);
  return map;
}

/* --------------------------------------------------------------- settings */

export function getSetting(key, fallback = null) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : fallback;
}

export function setSetting(key, value) {
  if (value == null || value === '') {
    db.prepare('DELETE FROM settings WHERE key = ?').run(key);
    return;
  }
  db.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(key, String(value));
}

/**
 * The birth year is optional, and it is the single thing that makes a timeline
 * mixing "age 16" with "2018" sortable. Without it, relative memories can only
 * be ordered against each other.
 */
export function getBirthYear() {
  const raw = getSetting('birth_year');
  const n = Number(raw);
  return Number.isInteger(n) && n > 1900 && n <= new Date().getFullYear() ? n : null;
}
