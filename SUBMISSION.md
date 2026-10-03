---
title: "Remember: I built my friend a memory app that runs its AI on a $7 box"
published: false
tags: devchallenge, weekendchallenge, hf26challenge
---

> **Before you publish, fill in the four `[[ ]]` placeholders.** They are the
> parts only you can write: who this is for, the live URL, the repo URL, and
> their reaction. Everything else is ready. Then delete this block.

*This is a submission for the [DEV Hacktoberfest Weekend Challenge](https://dev.to/challenges/hacktoberfest-weekend-2026-10-01): Build for a Friend.*

## What I Built

**Remember** is a private memory and self-reflection app. You save the moments,
people, places and songs that made you, and it gives them back to you as a
searchable timeline, a set of readable stories about your own life, and a button
called **Remind Me Who I Am**.

I built it for [[ who — one or two sentences: who they are to you, and the
actual moment that made you think of this. Be specific; this is the part judges
remember ]].

The problem is narrow and I want to state it plainly, because "journaling app"
undersells it. There is a specific failure mode where someone in a bad stretch
genuinely cannot access their own history. Not "feels sad about it" — cannot
retrieve it. Ask them to name something they're proud of and you get a long
pause. Every piece of evidence that they are a person who has survived things,
been loved, and done hard stuff is still in there, and none of it is reachable
from inside the moment.

So Remember is a retrieval system for that. You stock it on good days. On bad
days you press one button and it reads your own evidence back to you — with
names in it, and dates, and the actual titles of the actual things you wrote
down.

Here is real output, from the seeded demo timeline:

> You also wrote down 2 hard things: The week before Dad died and Three years
> clean. You wrote them in the past tense. That detail matters more than
> anything else on this page — it means you are on the other side of them.

That is the whole app. The rest is plumbing to make that paragraph specific and
true.

**What's in it:**

- **Add Memory** — a five-step guided flow, not a form. Only the title is required.
- **Timeline** — grouped into life chapters, searchable by meaning, filterable by category, feeling, person, tag and place.
- **Remind Me Who I Am** — the reflection above, plus the receipts it was built from.
- **Explore My Story** — seven lenses: My Life Story, My Strengths, People Who Matter Most, Places That Shaped Me, Challenges I Overcame, What My Memories Say About Me, My Current Chapter.
- **Prompt bank** — 30 questions that pre-fill the form, because a blank page is where this kind of app dies.
- **Insights** — people, feelings, themes, chapters, media.

## Demo

🔗 **[[ your Render URL ]]**

It ships with a seed command, so you can press *Remind Me Who I Am* on a full
timeline without writing anything personal first.

[[ Optional but strong: a 30-second screen recording. Home → Add a memory →
Timeline → Remind Me Who I Am. ]]

## Code

{% embed [[ your GitHub repo URL ]] %}

## How I Built It

Node + Express + SQLite on the backend, React + Vite on the front. One service,
one disk. The interesting part is the AI, which runs **entirely on my own
server**.

### Layer 1 — embeddings, in-process

`sentence-transformers/all-MiniLM-L6-v2` (Apache-2.0) via ONNX Runtime, inside
the Node process. Int8 quantised, about 25MB, downloaded once onto the disk.
After that the app works with the network unplugged.

### Layer 2 — zero-shot values with no classifier

I needed to detect what somebody's memories are *about* — resilience, family,
independence — with no labelled data. So each value is defined by a few short,
concrete example phrases, embedded and averaged into one prototype vector:

```js
{ id: 'resilience', label: 'Resilience', examples: [
  'I survived it and kept going',
  'the hardest year of my life and I made it through',
  'I got back up after losing everything',
]}
```

A memory is scored against all 21 prototypes, then the scores are **z-scored
across prototypes**. That centering step is the thing that makes it work. Raw
cosine with a small model is dominated by a generic "is this English prose"
component that is identical for every anchor; subtracting the per-memory mean
removes it and leaves the signal.

My first attempt used one long abstract sentence per value — *"family and the
people who raised me are at the center of my life"* — and it was bad. That
sentence sits in a vague region of the space and attracts everything. *"My
grandmother taught me to make bread on Sunday mornings"* came back
**Independence**, which is almost funny. Rewriting the anchors as short phrases
people actually say roughly doubled the separation:

| Memory | Top theme |
|---|---|
| *My grandmother taught me to make bread on Sunday mornings* | Family `2.91σ` |
| *I got clean after three years and I have not gone back* | Resilience `3.15σ` |
| *I finally graduated after working two jobs the whole time* | Achievement `3.19σ` |
| *I sat with my dad in the hospital the week before he died* | Grief & loss `2.08σ` |
| *I moved into my first apartment with nothing but a mattress* | Independence `2.80σ` |

### Layer 3 — prose, and why it's optional

The reflections are written by a **deterministic composer**, not a model. It
takes the structured signals and assembles warm, specific second-person text
under one rule: never assert anything the person's own memories don't support,
and always name real specifics.

An open-weight LLM can rewrite that text for warmth — any OpenAI-compatible
endpoint, so Ollama on a laptop works the same as a hosted provider. But it is
strictly a polish pass. With nothing configured, the composer's output ships
as-is, and if the endpoint is slow or down the app falls back silently. **The
app is fully functional with no LLM at all**, which was a hard requirement:
the user I built this for should never press that button and get an error.

### Two things that were harder than the AI

**Search had to work on how people actually remember.** Blending vectors with
keywords naively was worse than either alone — the query *"people who took care
of me"* scored against every memory containing "took" or "me", and the keyword
term drowned out the embedding completely. Stripping stopwords and making the
vector primary fixed it. Now *"being broke but okay"* finds **The apartment on
8th with the broken radiator**, which shares no meaningful word with the query,
while typing `Nana` still pulls the exact memory to the top — a 384-dimensional
model has never heard of your grandmother, which is exactly what the keyword
boost is for.

**Nobody remembers their life in ISO 8601.** The date field accepts
*"childhood"*, *"high school"*, *"age 16"*, *"10th grade"*, *"the 90s"*,
*"Christmas 2020"*, *"3 years ago"*. A parser maps all of it to a sortable
value. Then an optional birth year resolves every relative memory into a real
year, and a timeline mixing all three styles sorts correctly end to end:

```
2000     childhood        Nana's kitchen on Sunday mornings
2007.5   10th grade       Mr. Alvarez kept me in school
2008.5   high school      The night the power went out
2008.9   Christmas 2008   Christmas when Mom made it work anyway
2012.5   summer of 2012   Driving to the coast after graduation
2014.5   age 22           The apartment on 8th
2019.5   age 27           Graduating, finally, at 27
2019.8   October 2019     The week before Dad died
```

Every one of those was typed as loose text by a human who didn't want to think
about dates.

### Deploying on Render

`render.yaml` is a complete blueprint — one web service plus a 1GB persistent
disk at `/var/data`. SQLite, uploaded photos and the model cache all live on
that disk, so there's no managed database in the bill and nothing to expire.
Health checks hit `/api/health`, which reports the live state of both AI layers.

Running the model in-process is what makes it cheap. A starter instance with
512MB RAM comfortably holds int8 MiniLM, and there is no per-token cost at all
— so a personal app for one person costs about seven dollars a month, flat,
forever, no matter how much they write.

## Why Does Open Innovation Matter?

This app is pointed at somebody's most private material. A dead parent. A
sobriety date. A childhood bedroom. A friendship that ended badly.

The entire premise is that it is safe to write that down. A closed inference API
breaks the premise. Even assuming total good faith on the other end, "your
memories are private" quietly becomes "your memories are private, and also they
are POSTed to a company for processing." You cannot honestly tell someone their
grief is local when it is leaving the building. I was not willing to ship that
to a friend.

Three things in Remember exist *only* because the weights are open:

**1. The reflection engine has no runtime dependency on anyone.** The model is
on the disk. Pull the network cable and the app still searches, still detects
themes, still writes the reflection. No key to leak, no quota to hit, no vendor
whose pricing page can change what my friend's app does. I can hand them this
and it will behave identically in five years.

**2. The value system is a text file, not a model behaviour.** The themes
Remember is willing to notice live in `server/ai/anchors.js` as 21 short lists of
example phrases. Anyone can fork that file and change what the app says about
them — add a value, delete one, rewrite the examples in their own words. With a
closed model, the categories are whatever the vendor decided and they are not up
for discussion. For an app whose entire job is telling someone who they are,
that distinction is not academic.

**3. There is a real fully-local path.** Point the optional prose layer at
Ollama and the whole pipeline — embeddings *and* generation — runs on hardware
the user physically owns. That option simply does not exist with a closed API,
at any price.

There's a quieter argument too. Running a small open model in-process meant no
per-token cost, which meant I could stop optimising for API calls and just embed
everything, rescore on every read, and re-rank freely. A metered API would have
pushed me toward caching reflections and calling the model sparingly — and a
reflection that's stale after you add a memory is a worse product. Open weights
didn't just make this more private. They made it better.

## My Agent Session

I built this with Claude Code. The useful parts of the session were not code
generation — they were the three times it pushed back on output I'd have shipped:

- Catching that the reflection said *"2 hard things"* and *"1 heavy one"* two
  paragraphs apart, because "hard" was defined differently in two places. In an
  app whose only job is being trustworthy about your own life, that single
  inconsistency destroys the whole thing.
- Catching *"10 memories across 10 chapters"* — technically true, completely
  vacuous, and a tell that nothing real was being computed.
- Catching that "most recent memories" was ranking by similarity instead of by
  time, which let a 2012 road trip show up in *My Current Chapter*.

[[ Optional: your DevRelay session link ]]

## Prize Categories

- **Best Use of Render** — one blueprint, one service, persistent disk, open-weight model running in-process on a starter instance with no inference bill at all.

---

### What they said

[[ Show it to them and put their actual reaction here. The rules say bonus
points for demoing to the intended recipient — and honestly this is the only
part of the post that proves the thing works. ]]

---

Remember is MIT licensed. If you want to build your own version of this for
someone, the file to start with is `server/ai/anchors.js` — it is just sentences,
and it decides everything the app is able to see in a person.
