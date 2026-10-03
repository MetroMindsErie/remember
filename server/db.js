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

  -- One memory holds many files. A day out is photos AND a video AND the song
  -- that was playing, not a single photo_url. The original single-URL columns
  -- on the memories table are kept so existing entries keep working; anything
  -- added through capture lands here.
  CREATE TABLE IF NOT EXISTS attachments (
    id         TEXT PRIMARY KEY,
    memory_id  TEXT NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
    kind       TEXT NOT NULL,            -- photo | video | audio | link
    url        TEXT NOT NULL,
    name       TEXT NOT NULL DEFAULT '',
    mime       TEXT NOT NULL DEFAULT '',
    size       INTEGER NOT NULL DEFAULT 0,
    caption    TEXT NOT NULL DEFAULT '',
    position   INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_attachments_memory ON attachments(memory_id, position);

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

/* ------------------------------------------------------------ attachments */

export function attachmentsFor(memoryId) {
  return db
    .prepare('SELECT * FROM attachments WHERE memory_id = ? ORDER BY position, created_at')
    .all(memoryId);
}

/** All attachments, grouped by memory — one query instead of N. */
export function attachmentMap() {
  const map = new Map();
  for (const a of db.prepare('SELECT * FROM attachments ORDER BY position, created_at').all()) {
    if (!map.has(a.memory_id)) map.set(a.memory_id, []);
    map.get(a.memory_id).push(a);
  }
  return map;
}

export function replaceAttachments(memoryId, items) {
  const del = db.prepare('DELETE FROM attachments WHERE memory_id = ?');
  const ins = db.prepare(
    `INSERT INTO attachments (id, memory_id, kind, url, name, mime, size, caption, position, created_at)
     VALUES (@id, @memory_id, @kind, @url, @name, @mime, @size, @caption, @position, @created_at)`
  );
  db.transaction(() => {
    del.run(memoryId);
    items.forEach((a, i) => ins.run({ ...a, memory_id: memoryId, position: i }));
  })();
}

/** Every uploaded file path the database still refers to. */
export function referencedFiles() {
  const files = new Set();
  const add = (url) => {
    if (typeof url === 'string' && url.startsWith('/uploads/')) files.add(url.slice('/uploads/'.length));
  };
  for (const r of db.prepare('SELECT url FROM attachments').all()) add(r.url);
  for (const r of db.prepare('SELECT photo_url, video_url, music_url, attachment_url FROM memories').all()) {
    add(r.photo_url); add(r.video_url); add(r.music_url); add(r.attachment_url);
  }
  return files;
}
