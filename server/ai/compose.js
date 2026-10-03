/**
 * The deterministic prose composer.
 *
 * This is what makes Remember work with zero LLM configured. It takes the
 * structured signals and writes warm, specific, second-person reflection text.
 * The rule it follows: never assert anything the person's own memories do not
 * support, and always name real specifics (actual names, actual places) rather
 * than generic encouragement. Generic encouragement is what makes this kind of
 * app feel hollow.
 */

import { FEELING_TONE } from './anchors.js';

const list = (items, { max = 3, join = 'and' } = {}) => {
  const vals = items.slice(0, max);
  if (!vals.length) return '';
  if (vals.length === 1) return vals[0];
  if (vals.length === 2) return `${vals[0]} ${join} ${vals[1]}`;
  return `${vals.slice(0, -1).join(', ')} ${join} ${vals[vals.length - 1]}`;
};

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/** Picks a deterministic variant so the same data reads the same way twice. */
const pick = (variants, seed) => variants[Math.abs(seed) % variants.length];

/* --------------------------------------------------- remind me who I am */

export function composeReminder(signals) {
  const {
    total, people, places, achievements, challenges, values, feelings, chapters, arc,
  } = signals;

  if (!total) {
    return {
      headline: 'Your story starts with one memory.',
      paragraphs: [
        'There is nothing saved here yet, so there is nothing for me to reflect back to you. That is not a failure — it just means the first page is still blank.',
        'Add one memory. Any memory. The one that came to mind while you were reading this sentence. Remember builds everything else from there.',
      ],
      statements: ['You are allowed to start small.'],
      evidence: { people: [], places: [], values: [], proof: [] },
      empty: true,
    };
  }

  const seed = total * 31 + people.length * 7 + places.length;
  const names = people.map((p) => p.label);
  const placeNames = places.map((p) => p.label);
  const valueLabels = values.map((v) => v.label.toLowerCase());
  const topFeelings = feelings.map((f) => f.label);
  const paragraphs = [];

  /* --- opening: scale and scope --- */
  const chapterSpan = chapters.filter((c) => c.label !== 'Sometime').map((c) => c.label);
  let opening = `You have saved ${plural(total, 'memory', 'memories')}`;
  // Only mention the span when it is actually saying something. With one memory
  // per chapter the claim is technically true and completely vacuous.
  if (chapterSpan.length > 2 && chapterSpan.length < total) {
    opening += ` that reach across ${plural(chapterSpan.length, 'chapter', 'different chapters')} of your life`;
  } else if (signals.span && signals.span.earliest !== signals.span.latest) {
    opening += ` reaching from ${signals.span.earliest} to ${signals.span.latest}`;
  }
  opening += '. ';
  opening += pick([
    'Read that again, because it is evidence and not a feeling: this is a life with things in it.',
    'That is not an abstraction. That is a record, in your own words, of a life that actually happened.',
    'Whatever today feels like, these are already written down. They do not stop being true.',
  ], seed);
  paragraphs.push(opening);

  /* --- people --- */
  if (names.length) {
    const anchor = names[0];
    const repeat = people.filter((p) => p.count > 1);
    let p = '';
    if (repeat.length) {
      p += `${list(repeat.map((r) => r.label))} ${repeat.length === 1 ? 'shows' : 'show'} up in your memories more than once — ${anchor} in ${plural(people[0].count, 'memory', 'memories')}. `;
      p += 'People do not recur in a story by accident. ';
    } else {
      p += `${list(names)} ${names.length === 1 ? 'is' : 'are'} in here with you. `;
    }
    p += pick([
      'You have been held by somebody. You have also been the one doing the holding.',
      'You are not someone who has gone through life unwitnessed.',
      'Somebody has known you. That is not a small thing to have.',
    ], seed + 1);
    paragraphs.push(p);
  }

  /* --- places --- */
  if (placeNames.length) {
    paragraphs.push(
      `${list(placeNames, { max: 4 })} ${placeNames.length === 1 ? 'is a place that' : 'are places that'} made it into your story. ` +
      pick([
        'You can still picture them, which means part of you is still there and still yours.',
        'Places keep things for us. These ones are holding pieces of who you were.',
        'You have been somewhere. You have had a life with a map.',
      ], seed + 2)
    );
  }

  /* --- achievements --- */
  if (achievements.length) {
    const titles = achievements.map((a) => a.title);
    const shown = Math.min(2, titles.length);
    paragraphs.push(
      `You have ${plural(achievements.length, 'moment', 'moments')} saved that you were proud of` +
      `${achievements.length > shown ? ', including' : ':'} ${list(titles, { max: 2 })}. ` +
      pick([
        'You did those. Nobody did them for you.',
        'Those happened, and you were the one who made them happen.',
        'That is a track record, and it belongs to you.',
      ], seed + 3)
    );
  }

  /* --- challenges: the load-bearing paragraph --- */
  if (challenges.length) {
    const titles = challenges.map((c) => c.title);
    let p = `You also wrote down ${plural(challenges.length, 'hard thing', 'hard things')}` +
      `${challenges.length > Math.min(2, titles.length) ? ', including' : ':'} ${list(titles, { max: 2 })}. `;
    p += pick([
      'You wrote them in the past tense. That detail matters more than anything else on this page — it means you are on the other side of them.',
      'Every one of those was once the thing you were in the middle of. You are not in the middle of them now.',
      'Those were survived. Not avoided, not undone — survived, by you, with whatever you had at the time.',
    ], seed + 4);
    paragraphs.push(p);
  }

  /* --- values from the embedding model --- */
  if (valueLabels.length) {
    paragraphs.push(
      `Across everything you have saved, the same things keep surfacing: ${list(valueLabels, { max: 4 })}. ` +
      pick([
        'You did not choose those from a list. They are just what your own memories keep circling.',
        'Nobody told you those were your values. They are what is actually in your writing.',
        'That is not a personality test result. That is a pattern in your own handwriting.',
      ], seed + 5)
    );
  }

  /* --- closing --- */
  const closing = [];
  if (arc.hard > 0 && arc.positive > 0) {
    closing.push(
      `Your memories hold both — ${plural(arc.positive, 'good one', 'good ones')} and ${plural(arc.hard, 'heavy one', 'heavy ones')}. ` +
      'That is not a contradiction to resolve. That is just what a real life looks like from the inside.'
    );
  }
  closing.push(pick([
    'Whatever is happening right now is a chapter, not the book. You have proof of that in your own words, on this screen.',
    'This moment is not the whole story. You are holding the rest of it.',
    'You have been more than this before, and the record of it is right here.',
  ], seed + 6));
  paragraphs.push(closing.join(' '));

  /* --- short statements, for the card stack --- */
  const statements = [];
  if (challenges.length) statements.push(`You have already survived ${plural(challenges.length, 'thing', 'things')} that felt unsurvivable.`);
  if (names.length) statements.push(`You are known by ${list(names, { max: 2 })}.`);
  if (achievements.length) statements.push(`You have ${plural(achievements.length, 'reason', 'reasons')} to be proud of yourself on record.`);
  if (valueLabels.length) statements.push(`You are someone who cares about ${list(valueLabels, { max: 2 })}.`);
  if (topFeelings.length) statements.push(`The feeling you return to most is ${topFeelings[0].toLowerCase()}.`);
  statements.push('This moment is not the whole story.');

  const headline = pick([
    'Here is what your own memories say about you.',
    'This is who you are, in your own words.',
    'You asked to be reminded. Here it is.',
  ], seed);

  return {
    headline,
    paragraphs,
    statements: statements.slice(0, 5),
    evidence: {
      people: people.slice(0, 5),
      places: places.slice(0, 5),
      values: values.slice(0, 5),
      proof: [...challenges, ...achievements].slice(0, 4).map((m) => ({
        id: m.id, title: m.title, category: m.category, feeling: m.feeling, time_period: m.time_period,
      })),
    },
    empty: false,
  };
}

/* ------------------------------------------------------- explore my story */

export function composeStory(lens, ranked, signals) {
  const memories = ranked.map((r) => r.memory);
  if (!memories.length) {
    return {
      title: lens.label,
      paragraphs: ['Add a few memories and this section will fill itself in from what you write.'],
      highlights: [],
      empty: true,
    };
  }

  const titles = memories.map((m) => m.title);
  const paragraphs = [];
  const seed = memories.length * 13 + lens.id.length;
  // The cards shown under a section must be the memories the prose names,
  // not whatever the similarity ranking happened to put first.
  let featured = memories;

  switch (lens.mode) {
    case 'chronological': {
      const byChapter = new Map();
      for (const m of [...memories].sort((a, b) => (a.time_sort ?? 1e9) - (b.time_sort ?? 1e9))) {
        const key = m.chapter || 'Sometime';
        if (!byChapter.has(key)) byChapter.set(key, []);
        byChapter.get(key).push(m);
      }
      featured = [...memories].sort((a, b) => (a.time_sort ?? 1e9) - (b.time_sort ?? 1e9));
      paragraphs.push(
        `Your story, as you have told it so far, moves through ${plural(byChapter.size, 'chapter', 'chapters')}.`
      );
      for (const [chapter, items] of byChapter) {
        paragraphs.push(
          `**${chapter}.** ${list(items.map((i) => i.title), { max: 3 })}. ` +
          (items[0].meaning
            ? `In your words: "${items[0].meaning.replace(/\s+/g, ' ').slice(0, 180)}"`
            : `${plural(items.length, 'memory', 'memories')} from this stretch of your life.`)
        );
      }
      break;
    }

    case 'people': {
      const top = signals.people.slice(0, 6);
      paragraphs.push(
        top.length
          ? `${plural(top.length, 'person', 'people')} appear in the memories you have saved. ${list(top.map((p) => `${p.label} (${p.count})`), { max: 6 })}.`
          : 'You have not named anyone yet — try adding who was involved to a memory or two.'
      );
      featured = memories.filter((m) =>
        (m.people || []).some((p) => top.some((t) => t.label.toLowerCase() === p.toLowerCase()))
      );
      for (const person of top.slice(0, 3)) {
        const theirs = memories.filter((m) => (m.people || []).some((p) => p.toLowerCase() === person.label.toLowerCase()));
        if (!theirs.length) continue;
        paragraphs.push(
          `**${person.label}.** ${list(theirs.map((t) => t.title), { max: 3 })}. ` +
          `You felt ${list([...new Set(theirs.map((t) => t.feeling.toLowerCase()))], { max: 3 })} in those.`
        );
      }
      break;
    }

    case 'places': {
      const top = signals.places.slice(0, 6);
      paragraphs.push(
        top.length
          ? `Your memories are anchored in ${plural(top.length, 'place', 'places')}: ${list(top.map((p) => p.label), { max: 6 })}.`
          : 'No places saved yet. Adding where you were turns your timeline into a map.'
      );
      featured = memories.filter((m) =>
        top.some((t) => t.label.toLowerCase() === (m.place || '').toLowerCase())
      );
      for (const place of top.slice(0, 3)) {
        const there = memories.filter((m) => (m.place || '').toLowerCase() === place.label.toLowerCase());
        if (!there.length) continue;
        paragraphs.push(`**${place.label}.** ${list(there.map((t) => t.title), { max: 3 })}.`);
      }
      break;
    }

    case 'themes': {
      const vals = signals.values.slice(0, 5);
      paragraphs.push(
        vals.length
          ? `Reading across everything you have written, the strongest patterns are ${list(vals.map((v) => v.label.toLowerCase()), { max: 5 })}.`
          : 'Add a few more memories and the patterns will start to show.'
      );
      for (const v of vals.slice(0, 3)) {
        paragraphs.push(
          `**${v.label}.** This shows up in ${plural(v.memories, 'memory', 'memories')} — strongly enough that it reads as something you actually organise your life around, not just something that happened once.`
        );
      }
      paragraphs.push(
        `These were not picked from a questionnaire. They came out of running your own sentences through a model on this server and seeing what they cluster around.`
      );
      break;
    }

    case 'recent': {
      // Recency is a fact about time, not about similarity — so this ranks the
      // whole timeline by when things happened. Ranking the lens's top matches
      // instead let a 2012 road trip show up as a "recent" memory.
      const undated = (m) => m.time_sort == null;
      const recent = [...memories]
        .filter((m) => !undated(m))
        .sort((a, b) => b.time_sort - a.time_sort)
        .slice(0, 5);
      if (!recent.length) {
        return {
          title: lens.label,
          paragraphs: ['None of your memories have a time period yet, so there is no "recent" to read. Add a when — even something loose like "last year" — and this fills in.'],
          highlights: [], empty: false,
        };
      }
      featured = recent;
      paragraphs.push(
        `Where you are now, based on your most recent memories: ${list(recent.map((r) => r.title), { max: 3 })}.`
      );
      const feels = [...new Set(recent.map((r) => r.feeling.toLowerCase()))];
      paragraphs.push(
        `Lately you have been writing in terms of ${list(feels, { max: 3 })}. ` +
        pick([
          'Chapters are allowed to feel unfinished while you are still in them.',
          'You cannot see the shape of this one yet. That is normal — you could not see the shape of the others either.',
          'This is the part of the story you are still writing.',
        ], seed)
      );
      break;
    }

    default: { // 'ranked'
      paragraphs.push(
        `${plural(memories.length, 'memory', 'memories')} in your timeline speak to this most directly.`
      );
      for (const m of memories.slice(0, 4)) {
        paragraphs.push(
          `**${m.title}**${m.time_period ? ` (${m.time_period})` : ''}. ` +
          (m.meaning || m.memory_text || '').replace(/\s+/g, ' ').slice(0, 220)
        );
      }
      if (lens.id === 'overcame' && memories.length) {
        paragraphs.push(
          'Every one of these is written as something that happened, not something that is happening. You got past them.'
        );
      }
      if (lens.id === 'strengths' && memories.length) {
        paragraphs.push(
          'None of that was luck. Those are things you did, and you can do them again.'
        );
      }
    }
  }

  return {
    title: lens.label,
    paragraphs,
    highlights: featured.slice(0, 6).map((m) => ({
      id: m.id, title: m.title, category: m.category, feeling: m.feeling, time_period: m.time_period,
    })),
    empty: false,
  };
}

export { list, plural };
