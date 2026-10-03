import express from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { nanoid } from 'nanoid';
import { db, listMemories, getMemory, getBirthYear, setSetting } from '../db.js';
import { paths } from '../paths.js';
import { parseTimePeriod, chapterFor } from '../timeperiod.js';
import { CATEGORIES, FEELINGS } from '../ai/anchors.js';
import { ensureEmbeddings, semanticSearch } from '../ai/reflect.js';

export const router = express.Router();

/* ----------------------------------------------------------------- uploads */

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, paths.uploads),
  filename: (_req, file, cb) => {
    const ext = (path.extname(file.originalname) || '.jpg').toLowerCase().slice(0, 10);
    cb(null, `${Date.now()}-${nanoid(8)}${ext}`);
  },
});

const ALLOWED_IMAGE = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']);

const upload = multer({
  storage,
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_IMAGE.has(file.mimetype)) return cb(null, true);
    cb(new Error('Only image uploads are supported (jpg, png, webp, gif, heic).'));
  },
});

router.post('/uploads', upload.single('photo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file received.' });
  res.json({ url: `/uploads/${req.file.filename}`, size: req.file.size });
});

/* ------------------------------------------------------------- validation */

const asArray = (v) => {
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  if (typeof v === 'string') {
    return v.split(',').map((x) => x.trim()).filter(Boolean);
  }
  return [];
};

const str = (v, max = 4000) => String(v ?? '').trim().slice(0, max);

/** Only allow URLs we are willing to render or link to. */
function safeUrl(v) {
  const raw = str(v, 2000);
  if (!raw) return '';
  if (raw.startsWith('/uploads/')) return raw; // our own upload
  try {
    const u = new URL(raw);
    return ['http:', 'https:'].includes(u.protocol) ? u.toString() : '';
  } catch {
    return '';
  }
}

function normalize(body) {
  const title = str(body.title, 200);
  if (!title) {
    const err = new Error('A memory needs a title.');
    err.status = 400;
    throw err;
  }
  const category = CATEGORIES.includes(body.category) ? body.category : 'Other';
  const feeling = FEELINGS.includes(body.feeling) ? body.feeling : 'Nostalgic';
  const time_period = str(body.time_period, 120);
  const { sort } = parseTimePeriod(time_period, { birthYear: getBirthYear() });

  return {
    title,
    memory_text: str(body.memory_text, 8000),
    people: asArray(body.people).slice(0, 40),
    place: str(body.place, 200),
    time_period,
    time_sort: sort,
    category,
    feeling,
    meaning: str(body.meaning, 4000),
    photo_url: safeUrl(body.photo_url),
    video_url: safeUrl(body.video_url),
    music_url: safeUrl(body.music_url),
    attachment_url: safeUrl(body.attachment_url),
    tags: asArray(body.tags).slice(0, 30).map((t) => t.replace(/^#/, '')),
    prompt: str(body.prompt, 300),
  };
}

const decorate = (m) => ({ ...m, chapter: chapterFor(m.time_sort, m.time_period) });

/* ------------------------------------------------------------------ routes */

router.get('/memories', async (req, res, next) => {
  try {
    const {
      q, category, feeling, person, tag, place, sort = 'newest',
    } = req.query;

    let items;
    let scores = null;

    if (q && String(q).trim()) {
      const results = await semanticSearch(String(q));
      items = results.map((r) => r.memory);
      scores = new Map(results.map((r) => [r.memory.id, { score: r.score, matchedOn: r.matchedOn }]));
    } else {
      items = listMemories();
    }

    const eq = (a, b) => String(a || '').toLowerCase() === String(b || '').toLowerCase();
    if (category) items = items.filter((m) => eq(m.category, category));
    if (feeling) items = items.filter((m) => eq(m.feeling, feeling));
    if (place) items = items.filter((m) => eq(m.place, place));
    if (person) items = items.filter((m) => (m.people || []).some((p) => eq(p, person)));
    if (tag) items = items.filter((m) => (m.tags || []).some((t) => eq(t, tag)));

    // Relevance order is preserved when searching; otherwise sort by time.
    if (!scores) {
      const undatedLast = (m) => (m.time_sort == null ? 1 : 0);
      items.sort((a, b) => {
        const u = undatedLast(a) - undatedLast(b);
        if (u !== 0) return u;
        if (a.time_sort == null && b.time_sort == null) {
          return b.created_at.localeCompare(a.created_at);
        }
        return sort === 'oldest' ? a.time_sort - b.time_sort : b.time_sort - a.time_sort;
      });
    }

    res.json({
      memories: items.map((m) => ({
        ...decorate(m),
        ...(scores?.get(m.id) ? { _search: scores.get(m.id) } : {}),
      })),
      count: items.length,
      searched: Boolean(scores),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/memories/:id', (req, res) => {
  const m = getMemory(req.params.id);
  if (!m) return res.status(404).json({ error: 'Memory not found.' });
  res.json({ memory: decorate(m) });
});

router.post('/memories', async (req, res, next) => {
  try {
    const data = normalize(req.body);
    const now = new Date().toISOString();
    const id = nanoid(12);

    db.prepare(
      `INSERT INTO memories (
         id, created_at, updated_at, title, memory_text, people, place,
         time_period, time_sort, category, feeling, meaning, photo_url,
         video_url, music_url, attachment_url, tags, prompt
       ) VALUES (
         @id, @created_at, @updated_at, @title, @memory_text, @people, @place,
         @time_period, @time_sort, @category, @feeling, @meaning, @photo_url,
         @video_url, @music_url, @attachment_url, @tags, @prompt
       )`
    ).run({
      ...data,
      id,
      created_at: now,
      updated_at: now,
      people: JSON.stringify(data.people),
      tags: JSON.stringify(data.tags),
    });

    // Embed in the background: saving a memory must never wait on the model.
    ensureEmbeddings({ onlyId: id }).catch((e) => console.warn('[ai] embed failed:', e.message));

    res.status(201).json({ memory: decorate(getMemory(id)) });
  } catch (err) {
    next(err);
  }
});

router.put('/memories/:id', async (req, res, next) => {
  try {
    if (!getMemory(req.params.id)) return res.status(404).json({ error: 'Memory not found.' });
    const data = normalize(req.body);
    db.prepare(
      `UPDATE memories SET
         updated_at = @updated_at, title = @title, memory_text = @memory_text,
         people = @people, place = @place, time_period = @time_period,
         time_sort = @time_sort, category = @category, feeling = @feeling,
         meaning = @meaning, photo_url = @photo_url, video_url = @video_url,
         music_url = @music_url, attachment_url = @attachment_url,
         tags = @tags, prompt = @prompt
       WHERE id = @id`
    ).run({
      ...data,
      id: req.params.id,
      updated_at: new Date().toISOString(),
      people: JSON.stringify(data.people),
      tags: JSON.stringify(data.tags),
    });

    ensureEmbeddings({ onlyId: req.params.id }).catch((e) => console.warn('[ai] embed failed:', e.message));
    res.json({ memory: decorate(getMemory(req.params.id)) });
  } catch (err) {
    next(err);
  }
});

router.delete('/memories/:id', (req, res) => {
  const m = getMemory(req.params.id);
  if (!m) return res.status(404).json({ error: 'Memory not found.' });

  // Clean up an uploaded photo so deleting really deletes.
  if (m.photo_url?.startsWith('/uploads/')) {
    const file = path.join(paths.uploads, path.basename(m.photo_url));
    fs.promises.unlink(file).catch(() => {});
  }
  db.prepare('DELETE FROM embeddings WHERE memory_id = ?').run(req.params.id);
  db.prepare('DELETE FROM memories WHERE id = ?').run(req.params.id);
  res.json({ deleted: req.params.id });
});

/** Everything the timeline needs to build its filter menus. */
router.get('/facets', (_req, res) => {
  const memories = listMemories();
  const uniq = (vals) => [...new Set(vals.filter(Boolean))].sort((a, b) => a.localeCompare(b));
  res.json({
    categories: CATEGORIES,
    feelings: FEELINGS,
    usedCategories: uniq(memories.map((m) => m.category)),
    usedFeelings: uniq(memories.map((m) => m.feeling)),
    people: uniq(memories.flatMap((m) => m.people || [])),
    places: uniq(memories.map((m) => m.place)),
    tags: uniq(memories.flatMap((m) => m.tags || [])),
  });
});

/* --------------------------------------------------------------- settings */

router.get('/settings', (_req, res) => {
  res.json({ birthYear: getBirthYear() });
});

/**
 * Setting a birth year retroactively re-dates every relative memory ("age 16",
 * "high school") into real calendar years, so the timeline stops interleaving
 * life stages and years arbitrarily.
 */
router.put('/settings', (req, res) => {
  const raw = req.body?.birthYear;
  const year = raw === null || raw === '' ? null : Number(raw);
  if (year !== null && (!Number.isInteger(year) || year < 1900 || year > new Date().getFullYear())) {
    return res.status(400).json({ error: 'Birth year must be a real year.' });
  }
  setSetting('birth_year', year);

  const birthYear = getBirthYear();
  const update = db.prepare('UPDATE memories SET time_sort = ? WHERE id = ?');
  const redate = db.transaction((rows) => {
    for (const m of rows) {
      update.run(parseTimePeriod(m.time_period, { birthYear }).sort, m.id);
    }
  });
  const rows = listMemories();
  redate(rows);

  res.json({ birthYear, redated: rows.length });
});
