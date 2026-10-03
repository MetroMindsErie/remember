import express from 'express';
import { buildSignals, rankByLens } from '../ai/reflect.js';
import { composeReminder, composeStory } from '../ai/compose.js';
import { polishReminder, polishStory, llmStatus } from '../ai/llm.js';
import { STORY_LENSES } from '../ai/anchors.js';
import { embeddingStatus, EMBEDDING_MODEL } from '../ai/embeddings.js';
import { chapterFor } from '../timeperiod.js';
import { PROMPTS, PROMPT_GROUPS } from '../data/prompts.js';
import { listMemories } from '../db.js';

export const router = express.Router();

/** Remind Me Who I Am. */
router.get('/reflect/reminder', async (_req, res, next) => {
  try {
    const signals = await buildSignals();
    const draft = composeReminder(signals);
    const polished = await polishReminder(signals, draft);
    res.json({
      reminder: polished || draft,
      generatedBy: polished
        ? { embedding: EMBEDDING_MODEL, llm: polished.polishedBy }
        : { embedding: EMBEDDING_MODEL, llm: null },
      signals: {
        total: signals.total,
        values: signals.values,
        people: signals.people.slice(0, 6),
        places: signals.places.slice(0, 6),
        arc: signals.arc,
      },
    });
  } catch (err) {
    next(err);
  }
});

/** Explore My Story — the lens menu. */
router.get('/reflect/lenses', (_req, res) => {
  res.json({
    lenses: STORY_LENSES.map(({ id, label, blurb, icon }) => ({ id, label, blurb, icon })),
  });
});

router.get('/reflect/story/:lensId', async (req, res, next) => {
  try {
    const lens = STORY_LENSES.find((l) => l.id === req.params.lensId);
    if (!lens) return res.status(404).json({ error: 'Unknown story lens.' });

    const signals = await buildSignals();
    // Modes that reason over the whole life (chapters, people, places, themes,
    // recency) need every memory; only the "pick the most relevant few" modes
    // want a narrow top-k.
    const wholeTimeline = ['chronological', 'people', 'places', 'themes', 'recent'].includes(lens.mode);
    const ranked = await rankByLens(lens.id, { limit: wholeTimeline ? 500 : 8 });
    // The chronological lens needs chapter labels on each memory.
    const withChapters = ranked.map((r) => ({
      ...r,
      memory: { ...r.memory, chapter: chapterFor(r.memory.time_sort, r.memory.time_period) },
    }));

    const draft = composeStory(lens, withChapters, signals);
    const polished = await polishStory(lens, signals, draft);
    res.json({
      story: polished || draft,
      lens: { id: lens.id, label: lens.label, blurb: lens.blurb, icon: lens.icon },
      generatedBy: { embedding: EMBEDDING_MODEL, llm: polished?.polishedBy || null },
    });
  } catch (err) {
    next(err);
  }
});

/** Insights dashboard. */
router.get('/insights', async (_req, res, next) => {
  try {
    const signals = await buildSignals();
    const memories = listMemories();
    res.json({
      total: signals.total,
      topFeeling: signals.feelings[0] || null,
      topCategory: signals.categories[0] || null,
      feelings: signals.feelings,
      categories: signals.categories,
      people: signals.people.slice(0, 10),
      places: signals.places.slice(0, 10),
      tags: signals.tags.slice(0, 15),
      chapters: signals.chapters,
      media: signals.media,
      arc: signals.arc,
      values: signals.values,
      withMedia: memories.filter(
        (m) => m.photo_url || m.music_url || m.video_url || m.attachment_url
      ).length,
      firstSaved: memories.length
        ? memories.reduce((a, b) => (a.created_at < b.created_at ? a : b)).created_at
        : null,
      ai: { embedding: embeddingStatus(), llm: llmStatus(), vectors: signals.ai?.vectors ?? 0 },
    });
  } catch (err) {
    next(err);
  }
});

/** Prompt bank. Unanswered prompts first, gentle openers weighted up. */
router.get('/prompts', (_req, res) => {
  const answered = new Set(listMemories().map((m) => m.prompt).filter(Boolean));
  const prompts = PROMPTS.map((p) => ({ ...p, answered: answered.has(p.text) }));
  res.json({ prompts, groups: PROMPT_GROUPS, answeredCount: answered.size });
});

/** Health + a transparent view of exactly which AI is running. */
router.get('/health', (_req, res) => {
  res.json({
    ok: true,
    embedding: embeddingStatus(),
    llm: llmStatus(),
    memories: listMemories().length,
  });
});
