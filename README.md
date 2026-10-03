# Remember

**Reconnect with who you are.**

A private memory, identity and self-reflection app. You save the moments, people,
places and songs that made you — and Remember turns them into a searchable
timeline, a set of readable stories about your own life, and a feature called
**Remind Me Who I Am** that reads your own evidence back to you on the days you
need it.

The AI that does that reading is an **open-weight model running on your own
server**. No API key, no third party, no account.

## Two ways in

Remembering something from 1998 and saving something that happened this
afternoon are different jobs, so they get different screens.

**Capture** is media-first. You just got home, your phone is full of the day —
drop in photos, video clips and voice notes all at once, say what happened, and
it is on the timeline. Files upload as you pick them, so pressing Save is
instant rather than a 100MB wait. Every file can carry its own caption, and
those captions are embedded and searchable along with the memory text.

**Add Memory** is the guided flow: five short steps, one question at a time,
for excavating something from years back where the work is remembering rather
than uploading.

Both write to the same timeline, and both accept a pasted URL as a fallback when
uploading is awkward — an image link, a YouTube video or a Spotify track, which
render as real players inside the card.

---

## Why open weights, specifically

This app is pointed at somebody's most private material: a dead parent, a
sobriety date, a childhood bedroom, a friendship that ended. The entire premise
is that it is safe to write that down.

A closed inference API breaks the premise. Even with the best intentions on the
other end, "your memories are private" becomes "your memories are private, and
also they go to a company's servers to be processed." You cannot honestly tell
somebody that their grief is local when it is being POSTed somewhere.

So Remember runs `sentence-transformers/all-MiniLM-L6-v2` (Apache-2.0) directly
inside the Node process via ONNX Runtime. The model is downloaded once and
cached on disk. After that the app works **with the network unplugged**. Memory
text is turned into vectors in the same process that stores it, and those
vectors never leave the machine.

Three concrete things that only work because the weights are open:

1. **Offline inference.** The reflection engine has no external dependency at
   runtime. No key to leak, no quota to hit, no vendor to outlive the app.
2. **An editable value system.** The "themes" Remember detects are not baked
   into a model. They are twenty short lists of example phrases in
   [`server/ai/anchors.js`](server/ai/anchors.js). Anyone can fork that file and
   change what the app is willing to notice about them — a closed model's
   categories are not up for discussion.
3. **A real local-LLM path.** The optional prose layer speaks the
   OpenAI-compatible chat API, so you can point it at Ollama on your own laptop
   and the whole pipeline — embeddings *and* generation — stays on hardware you
   own.

---

## The AI, in three layers

| Layer | What it does | Runs where |
|---|---|---|
| **Embeddings** | `all-MiniLM-L6-v2` turns each memory into a 384-d vector | In-process, ONNX. Always. |
| **Reflection** | Zero-shot value scoring, semantic retrieval, theme ranking | Pure JS over those vectors |
| **Prose** | Optional open-weight LLM rewrites the composed text | Ollama / vLLM / any OpenAI-compatible host |

**Layer 3 is optional on purpose.** Remember writes complete, specific,
emotionally useful reflections with no LLM configured at all — a deterministic
composer in [`server/ai/compose.js`](server/ai/compose.js) builds them from the
signals. An LLM only makes the prose warmer. If it is slow, down, or absent, the
app silently falls back and the user never sees an error.

### Zero-shot values without a classifier

There is no labelled training data for "this memory is about resilience". So
each value is defined by a handful of short, concrete example phrases, embedded
and averaged into one prototype vector:

```js
{ id: 'resilience', label: 'Resilience', examples: [
  'I survived it and kept going',
  'the hardest year of my life and I made it through',
  'I got back up after losing everything',
]}
```

A memory is scored against all 21 prototypes, and the scores are then
**z-scored across prototypes**. That centering step is what makes it work: raw
cosine with a small model is dominated by a generic "is this English prose"
component identical for every anchor. Subtracting the per-memory mean removes it
and leaves the actual signal.

Concrete multi-phrase anchors mattered more than expected. One long abstract
sentence per value (*"family and the people who raised me are at the center of my
life"*) sat in a vague region of the space and attracted everything — "my
grandmother taught me to make bread" came back **Independence**. Rewriting the
anchors as short phrases people actually use roughly doubled the separation and
fixed every misclassification in testing:

| Memory | Top theme |
|---|---|
| *My grandmother taught me to make bread on Sunday mornings* | Family `2.91σ` |
| *I got clean after three years and I have not gone back* | Resilience `3.15σ` |
| *I finally graduated after working two jobs the whole time* | Achievement `3.19σ` |
| *I sat with my dad in the hospital the week before he died* | Grief & loss `2.08σ` |
| *I moved into my first apartment with nothing but a mattress* | Independence `2.80σ` |

### Search that works on how you remember things

Search blends the vector score with a keyword boost, vector-first. Stopwords are
stripped, because a query like *"people who took care of me"* otherwise scores
against every memory containing "took" or "me" and the keyword term drowns out
the embedding entirely.

The result: *"being broke but okay"* finds **The apartment on 8th with the broken
radiator**, which shares no meaningful word with the query. Typing `Nana` still
pulls the exact memory to the top, which is what the keyword boost is for —
a 384-d model has never heard of your grandmother.

### Dates the way people actually say them

Nobody remembers their life in ISO 8601. The parser in
[`server/timeperiod.js`](server/timeperiod.js) takes what you'd actually say and
produces a sortable value:

```
"childhood"        "high school"      "age 16"        "Christmas 2020"
"the 90s"          "10th grade"       "3 years ago"   "summer of 2012"
"senior year"      "2012-2015"        "last year"     "7/4/2018"
```

Set an optional birth year and every relative memory resolves to a real year, so
a timeline mixing *"childhood"*, *"10th grade"* and *"October 2019"* sorts
correctly end to end:

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

---

## Run it

```bash
npm install
npm run build
npm start          # → http://localhost:3000
```

Or with hot reload (API on 3000, Vite on 5173):

```bash
npm install && npm run dev
```

Want data to look at? With the server running:

```bash
npm run seed
```

The embedding model (~25MB, int8) downloads on first boot into `DATA_DIR/model-cache`.
That is the only time the app touches the network.

### Optional: add a local LLM

```bash
ollama pull qwen2.5:7b-instruct
```

```bash
OPEN_MODEL_BASE_URL=http://localhost:11434/v1 OPEN_MODEL_NAME=qwen2.5:7b-instruct npm start
```

Now embeddings *and* generation run on your machine. Any OpenAI-compatible host
works — llama.cpp, vLLM, TGI, Together, Groq, Fireworks, OpenRouter.

---

## Deploy to Render

[`render.yaml`](render.yaml) is a complete blueprint: **New → Blueprint**, point
it at this repo, done.

One web service plus a 1GB persistent disk at `/var/data`. SQLite, uploaded
photos and the model cache all live there, so there is no managed database in
the bill and nothing expires. Health checks hit `/api/health`, which reports the
live state of both AI layers.

Running the model in-process is what makes this cheap: a starter instance with
512MB RAM comfortably holds int8 MiniLM, and there is no per-token cost at all,
so the whole app is one small service.

---

## What's in here

```
server/
  index.js            Express app, serves API + built SPA
  db.js               SQLite schema, memories + vectors + settings
  timeperiod.js       "high school" → a sortable year
  ai/
    embeddings.js     Local ONNX inference, vector helpers
    anchors.js        Value prototypes + story lenses  ← fork this
    reflect.js        Signals, semantic search, lens ranking
    compose.js        Deterministic prose composer (works with no LLM)
    llm.js            Optional OpenAI-compatible open-weight polish
  routes/             REST API
client/
  src/pages/          Home · Capture · Add · Timeline · Remind Me · Explore · Insights · Prompts · Settings
  src/components/     MediaPicker, MediaGallery + lightbox, MemoryCard
  src/styles/         Design tokens, light + dark
```

### API

| Method | Route | |
|---|---|---|
| `GET` | `/api/memories` | list, filter, or semantic search via `?q=` |
| `POST` | `/api/memories` | create |
| `PUT`/`DELETE` | `/api/memories/:id` | update / delete |
| `POST` | `/api/uploads` | multi-file upload (photo / video / audio) |
| `GET` | `/api/storage` | disk usage and per-kind size limits |
| `GET` | `/api/facets` | filter options |
| `GET` | `/api/prompts` | prompt bank, with answered state |
| `GET` | `/api/reflect/reminder` | Remind Me Who I Am |
| `GET` | `/api/reflect/lenses` · `/api/reflect/story/:id` | Explore My Story |
| `GET` | `/api/insights` | dashboard stats |
| `GET`/`PUT` | `/api/settings` | birth year (re-dates the timeline) |
| `GET` | `/api/health` | status of both AI layers |

---

## Privacy

> Your memories are personal. This app is designed for private reflection.
> Only share what you choose.

No accounts, no analytics, no tracking, no third-party calls, no sharing
features. Memories live in a SQLite file; photos live next to it on disk.
Deleting a memory deletes its uploaded photo and its vector too.

---

## Future: Urge integration

Remember is designed to be opened from the **Urge** app as a coping tool called
*"Reconnect With Yourself"* — when someone is in a hard moment, hand them proof
of who they are instead of a platitude. The apps are deliberately separate for
now; nothing is merged.

---

MIT licensed. Built for the DEV Hacktoberfest 2026 "Build for a Friend" challenge.
