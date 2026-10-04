import express from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { nanoid } from 'nanoid';
import {
  db, listMemories, getMemory, getBirthYear, setSetting,
  attachmentsFor, attachmentMap, replaceAttachments,
} from '../db.js';
import { paths } from '../paths.js';
import { parseTimePeriod, chapterFor, sortFromDate, formatDate } from '../timeperiod.js';
import { captureDateOf } from '../exif.js';
import { CATEGORIES, FEELINGS } from '../ai/anchors.js';
import { ensureEmbeddings, semanticSearch } from '../ai/reflect.js';

export const router = express.Router();

/* ----------------------------------------------------------------- uploads */

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, paths.uploads),
  filename: (_req, file, cb) => {
    const ext = (path.extname(file.originalname) || '').toLowerCase().slice(0, 10) || '.bin';
    cb(null, `${Date.now()}-${nanoid(8)}${ext}`);
  },
});

/**
 * What a phone actually produces when you tap "share" after a day out: HEIC
 * stills, an H.264 or HEVC clip, maybe a voice memo. All of it is allowed.
 */
const ALLOWED = {
  photo: new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif', 'image/avif']),
  video: new Set(['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v', 'video/mpeg', 'video/3gpp']),
  audio: new Set(['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/webm', 'audio/flac']),
};

export function kindOf(mime) {
  for (const [kind, set] of Object.entries(ALLOWED)) if (set.has(mime)) return kind;
  // Fall back to the top-level type: phones invent subtypes all the time.
  const top = String(mime || '').split('/')[0];
  if (top === 'image') return 'photo';
  if (top === 'video') return 'video';
  if (top === 'audio') return 'audio';
  return null;
}

// Per-kind caps. Video is the one that can actually fill a disk, so it gets a
// deliberate ceiling rather than the same limit as a photo.
export const SIZE_LIMITS = {
  photo: 15 * 1024 * 1024,
  audio: 30 * 1024 * 1024,
  video: 150 * 1024 * 1024,
};

const MAX_FILES = 20;

const upload = multer({
  storage,
  limits: { fileSize: SIZE_LIMITS.video, files: MAX_FILES },
  fileFilter: (_req, file, cb) => {
    if (kindOf(file.mimetype)) return cb(null, true);
    cb(new Error(`${file.originalname} is not a photo, video or audio file.`));
  },
});

const prettyBytes = (n) => {
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(1)}GB`;
  if (n >= 1024 ** 2) return `${Math.round(n / 1024 ** 2)}MB`;
  return `${Math.max(1, Math.round(n / 1024))}KB`;
};

async function describe(file) {
  const kind = kindOf(file.mimetype);
  return {
    id: nanoid(12),
    kind,
    url: `/uploads/${file.filename}`,
    name: file.originalname.slice(0, 200),
    mime: file.mimetype,
    size: file.size,
    caption: '',
    // The day the shutter was pressed, when the file still carries it. The
    // client uses the earliest of these to date the memory, so a batch of
    // holiday photos lands on the right day without anyone typing it.
    capturedAt: kind === 'photo' ? await captureDateOf(file.path) : '',
  };
}

/**
 * Multi-file upload. Files are stored and described, but NOT attached to a
 * memory yet, the client holds them while the person writes, then sends the
 * list with the memory. Anything abandoned is swept up by the orphan cleaner.
 */
router.post('/uploads', upload.array('files', MAX_FILES), async (req, res, next) => {
  try {
    const files = req.files || [];
    if (!files.length) return res.status(400).json({ error: 'No files received.' });

    const accepted = [];
    const rejected = [];
    for (const file of files) {
      const kind = kindOf(file.mimetype);
      const limit = SIZE_LIMITS[kind] ?? SIZE_LIMITS.photo;
      if (file.size > limit) {
        // Multer's single limit is the video cap, so smaller per-kind limits
        // are enforced here. And the oversized file is removed from disk.
        fs.promises.unlink(file.path).catch(() => {});
        rejected.push({ name: file.originalname, reason: `${kind} files are limited to ${prettyBytes(limit)}` });
        continue;
      }
      accepted.push(await describe(file));
    }
    res.json({ files: accepted, rejected });
  } catch (err) {
    next(err);
  }
});

/** Kept so the older single-photo field in Add Memory still works. */
router.post('/uploads/photo', upload.single('photo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file received.' });
  res.json({ url: `/uploads/${req.file.filename}`, size: req.file.size });
});

/** How much of the disk the uploads have taken. Videos make this matter. */
router.get('/storage', async (_req, res, next) => {
  try {
    const names = await fs.promises.readdir(paths.uploads).catch(() => []);
    let bytes = 0;
    for (const name of names) {
      const stat = await fs.promises.stat(path.join(paths.uploads, name)).catch(() => null);
      if (stat?.isFile()) bytes += stat.size;
    }
    res.json({ files: names.length, bytes, pretty: prettyBytes(bytes), limits: SIZE_LIMITS, maxFiles: MAX_FILES });
  } catch (err) {
    next(err);
  }
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

/** Validates the attachment list a client sends back with a memory. */
function normalizeAttachments(body) {
  const raw = Array.isArray(body.attachments) ? body.attachments : [];
  return raw.slice(0, 40).map((a) => {
    const url = safeUrl(a?.url);
    const kind = ['photo', 'video', 'audio', 'link'].includes(a?.kind) ? a.kind : 'link';
    return url ? {
      id: str(a.id, 40) || nanoid(12),
      kind,
      url,
      name: str(a.name, 200),
      mime: str(a.mime, 100),
      size: Number.isFinite(Number(a.size)) ? Math.max(0, Math.trunc(Number(a.size))) : 0,
      caption: str(a.caption, 500),
      created_at: new Date().toISOString(),
    } : null;
  }).filter(Boolean);
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

  // An exact date, when the person picked one or a photo supplied it, beats
  // anything we could infer from a phrase. It drives the sort directly.
  const happened_on = /^\d{4}-\d{2}-\d{2}$/.test(str(body.happened_on, 10))
    ? str(body.happened_on, 10)
    : '';
  const exactSort = happened_on ? sortFromDate(happened_on) : null;
  const sort = exactSort ?? parseTimePeriod(time_period, { birthYear: getBirthYear() }).sort;

  return {
    title,
    memory_text: str(body.memory_text, 8000),
    people: asArray(body.people).slice(0, 40),
    place: str(body.place, 200),
    time_period,
    happened_on,
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

const decorate = (m, attachments) => ({
  ...m,
  chapter: chapterFor(m.time_sort, m.time_period),
  dateLabel: m.happened_on ? formatDate(m.happened_on) : '',
  attachments: attachments ?? attachmentsFor(m.id),
});

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

    const byMemory = attachmentMap();
    res.json({
      memories: items.map((m) => ({
        ...decorate(m, byMemory.get(m.id) ?? []),
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
         time_period, happened_on, time_sort, category, feeling, meaning,
         photo_url, video_url, music_url, attachment_url, tags, prompt
       ) VALUES (
         @id, @created_at, @updated_at, @title, @memory_text, @people, @place,
         @time_period, @happened_on, @time_sort, @category, @feeling, @meaning,
         @photo_url, @video_url, @music_url, @attachment_url, @tags, @prompt
       )`
    ).run({
      ...data,
      id,
      created_at: now,
      updated_at: now,
      people: JSON.stringify(data.people),
      tags: JSON.stringify(data.tags),
    });

    replaceAttachments(id, normalizeAttachments(req.body));

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
         happened_on = @happened_on, time_sort = @time_sort,
         category = @category, feeling = @feeling,
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

    // Files dropped during an edit should leave the disk, not linger forever.
    const before = attachmentsFor(req.params.id).map((a) => a.url);
    const next = normalizeAttachments(req.body);
    replaceAttachments(req.params.id, next);
    const keep = new Set(next.map((a) => a.url));
    for (const url of before) {
      if (!keep.has(url) && url.startsWith('/uploads/')) {
        fs.promises.unlink(path.join(paths.uploads, path.basename(url))).catch(() => {});
      }
    }

    ensureEmbeddings({ onlyId: req.params.id }).catch((e) => console.warn('[ai] embed failed:', e.message));
    res.json({ memory: decorate(getMemory(req.params.id)) });
  } catch (err) {
    next(err);
  }
});

router.delete('/memories/:id', (req, res) => {
  const m = getMemory(req.params.id);
  if (!m) return res.status(404).json({ error: 'Memory not found.' });

  // Deleting has to really delete, every uploaded file this memory owned.
  const owned = [m.photo_url, ...attachmentsFor(m.id).map((a) => a.url)];
  for (const url of owned) {
    if (typeof url === 'string' && url.startsWith('/uploads/')) {
      fs.promises.unlink(path.join(paths.uploads, path.basename(url))).catch(() => {});
    }
  }
  db.prepare('DELETE FROM attachments WHERE memory_id = ?').run(req.params.id);
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
      // A real date is already correct; only inferred ones get recomputed.
      if (m.happened_on) continue;
      update.run(parseTimePeriod(m.time_period, { birthYear }).sort, m.id);
    }
  });
  const rows = listMemories();
  redate(rows);

  res.json({ birthYear, redated: rows.length });
});
