---
title: "Remember: a memory app that runs its AI on a $7 box"
published: false
tags: devchallenge, weekendchallenge, hf26challenge
---

<!-- ============================================================
  BEFORE YOU PUBLISH, fill in the four [[ ]] blocks. They are the
  parts only you can write. Then delete this comment.
     1. Who you built it for (What I Built)
     2. Your Render URL (Demo)
     3. Your agent session link, or delete that section
     4. Their reaction after you show them (end of post)
  Everything else is done.
============================================================= -->

*This is a submission for the [Hacktoberfest Weekend Challenge: Build for a Friend](https://dev.to/challenges/hacktoberfest-weekend-2026-10-01)*

## What I Built

**Remember** is a private memory app. You save the moments, people, places and songs that made you, and it gives them back as a searchable timeline, a set of readable stories about your own life, and a button called **Remind Me Who I Am**.

I built it for [[ who. One or two sentences: who they are to you, and the actual moment that made you think of this. Be specific. This is the part judges remember. ]]

I want to state the problem plainly, because "journaling app" undersells it. There is a specific failure mode where someone in a bad stretch cannot access their own history. Not "feels sad about it." Cannot retrieve it. Ask them to name something they are proud of and you get a long pause. Every piece of evidence that they are a person who has survived things, been loved, and done hard stuff is still in there, and none of it is reachable from inside the moment.

So Remember is a retrieval system for that. You stock it on good days. On bad days you press one button and it reads your own evidence back to you, with real names in it, and real dates, and the actual titles of the actual things you wrote down.

Here is unedited output from the seeded demo timeline:

> You also wrote down 2 hard things: The week before Dad died and Three years clean. You wrote them in the past tense. That detail matters more than anything else on this page. It means you are on the other side of them.

That paragraph is the whole app. Everything else is plumbing to make it specific and true.

**What is in it:**

- **Capture** is media-first. Home from a day out, drop in every photo, video clip and voice note at once, say what happened, done.
- **Add Memory** is a guided five-step flow for excavating something from years back, where the work is remembering rather than uploading.
- **Timeline** grouped into life chapters, searchable by meaning, filterable by person, feeling, category, place and tag.
- **Remind Me Who I Am**, the reflection above, plus the receipts it was built from.
- **Explore My Story**: seven lenses, including My Strengths, People Who Matter Most, Challenges I Overcame, and What My Memories Say About Me.
- **30 prompts** that pre-fill the form, because a blank page is where this kind of app dies.
- **Insights**: people, feelings, themes, chapters, media.

## Demo

🔗 **[[ your Render URL ]]**

It ships with `npm run seed`, so you can press *Remind Me Who I Am* against a full timeline without writing anything personal first.

[[ Optional but strong: a 30-second screen recording. Home, Capture, Timeline, Remind Me Who I Am. ]]

## Code

{% embed https://github.com/MetroMindsErie/remember %}

## How I Built It

Node, Express and SQLite on the back, React and Vite on the front. One service, one disk. The interesting part is that the AI runs **entirely inside my own server process**.

### Layer 1: embeddings, in-process

`sentence-transformers/all-MiniLM-L6-v2` (Apache-2.0) through ONNX Runtime, inside Node. Int8 quantised, 24MB, downloaded once onto the disk. After that the app works with the network unplugged.

### Layer 2: zero-shot values with no classifier

I needed to detect what somebody's memories are *about* with no labelled data. So each value is defined by a handful of short, concrete example phrases, embedded and averaged into one prototype vector. 21 values, 88 phrases total:

```js
{ id: 'resilience', label: 'Resilience', examples: [
  'I survived it and kept going',
  'the hardest year of my life and I made it through',
  'I got back up after losing everything',
]}
```

A memory scores against all 21 prototypes, then the scores are **z-scored across prototypes**. That centering step is what makes it work. Raw cosine with a small model is dominated by a generic "is this English prose" component that is identical for every anchor. Subtracting the per-memory mean removes it and leaves the signal.

My first attempt used one long abstract sentence per value, like *"family and the people who raised me are at the center of my life."* It was bad. That sentence sits in a vague region of the space and attracts everything. *"My grandmother taught me to make bread on Sunday mornings"* came back **Independence**, which is almost funny. Rewriting the anchors as short phrases people actually say roughly doubled the separation:

| Memory | Top theme |
|---|---|
| *My grandmother taught me to make bread on Sunday mornings* | Family `2.91σ` |
| *I got clean after three years and I have not gone back* | Resilience `3.15σ` |
| *I finally graduated after working two jobs the whole time* | Achievement `3.19σ` |
| *I sat with my dad in the hospital the week before he died* | Grief & loss `2.08σ` |
| *I moved into my first apartment with nothing but a mattress* | Independence `2.80σ` |

### Layer 3: prose, and why it is optional

The reflections are written by a **deterministic composer**, not a model. It takes the structured signals and assembles warm, specific second-person text under one rule: never assert anything the person's own memories do not support, and always name real specifics.

An open-weight LLM can rewrite that text for warmth, over any OpenAI-compatible endpoint, so Ollama on a laptop works the same as a hosted provider. But it is strictly a polish pass. With nothing configured, the composer's output ships as-is, and if the endpoint is slow or down the app falls back silently. **The app is fully functional with no LLM at all**, which was a hard requirement: the person I built this for should never press that button and get an error.

That requirement turned out to be load-bearing. More on that below.

### Two things that were harder than the AI

**Search had to work on how people actually remember.** Blending vectors with keywords naively was worse than either alone. The query *"people who took care of me"* scored against every memory containing "took" or "me", and the keyword term drowned out the embedding completely. Stripping stopwords and making the vector primary fixed it. Now *"being broke but okay"* finds **The apartment on 8th with the broken radiator**, which shares no meaningful word with the query, while typing `Nana` still pulls the exact memory to the top. A 384-dimensional model has never heard of your grandmother, which is exactly what the keyword boost is for.

**Nobody remembers their life in ISO 8601.** The date field accepts *"childhood"*, *"high school"*, *"age 16"*, *"10th grade"*, *"the 90s"*, *"Christmas 2020"*, *"3 years ago"*. A parser maps all of it onto one sortable scale. When you do know the exact day there is a calendar instead, and both kinds interleave correctly:

```
2000.0   childhood         Nana's kitchen on Sunday mornings
2007.5   10th grade        Mr. Alvarez kept me in school
2012.5   summer of 2012    Driving to the coast after graduation
2015.6   21 August 2015    Nora at the lake            <- read off a photo
2019.5   age 27            Graduating, finally, at 27
2022.8   3 November 2022   Milo's first day of school  <- picked on a calendar
```

Most of those were typed as loose text by a human who did not want to think about dates. And the ones with real dates mostly dated themselves: phones stamp capture time into every photo, so dropping a batch into Capture in whatever order it came off the camera roll reads the dates off the files. The day something happened and the day you got round to saving it are different facts, and only one of them belongs on a timeline.

### Deploying on Render

`render.yaml` is a complete blueprint. One web service plus a persistent disk at `/var/data`. SQLite, uploaded photos and the model cache all live on that disk, so there is no managed database in the bill and nothing expires. Health checks hit `/api/health`, which reports the live state of both AI layers.

Running the model in-process is what makes it cheap. A starter instance holds int8 MiniLM comfortably at **54MB RSS** with the model loaded and serving, and there is no per-token cost at all. A personal app for one person costs about eight dollars a month, flat, forever, no matter how much they write.

## Why Does Open Innovation Matter?

This app is pointed at somebody's most private material. A dead parent. A sobriety date. A childhood bedroom. A friendship that ended badly.

The entire premise is that it is safe to write that down. A closed inference API breaks the premise. Even assuming total good faith on the other end, "your memories are private" quietly becomes "your memories are private, and also they are POSTed to a company for processing." You cannot honestly tell someone their grief is local when it is leaving the building. I was not willing to ship that to a friend.

Three things in Remember exist *only* because the weights are open.

**1. The reflection engine depends on nobody.** The model is on the disk. Pull the network cable and the app still searches, still detects themes, still writes the reflection. No key to leak, no quota to hit, no vendor whose pricing page can change what my friend's app does. I can hand them this and it will behave identically in five years.

**2. The value system is a text file, not a model behaviour.** The themes Remember is willing to notice live in `server/ai/anchors.js` as 21 short lists of example phrases. Anyone can fork that file and change what the app says about them: add a value, delete one, rewrite the examples in their own words. With a closed model the categories are whatever the vendor decided, and they are not up for discussion. For an app whose entire job is telling someone who they are, that distinction is not academic.

**3. There is a real fully-local path.** Point the optional prose layer at Ollama and the whole pipeline, embeddings *and* generation, runs on hardware the user physically owns. That option does not exist with a closed API at any price.

And then there is the thing I only learned because I could actually inspect the model layer.

I wired up llama3.1:8b through Ollama to test the optional polish pass. At its default temperature it rewrote the memory **"Three years clean"** as *"the three years it took to get clean from whatever was holding you back."* That inverts a sobriety milestone into a description of struggle. It also invented a decade the data did not contain, a weekly ritual at a parking lot, and "sun-kissed beaches."

For this app specifically, that is disqualifying. Not a quality issue, a safety one.

Because the model was mine, the fix was mine too: drop the temperature to 0.2, forbid reinterpreting a memory title, forbid adding sensory colour, forbid estimating spans of time. All four failures went away. With a closed API I would have had a prompt and a prayer, and no way to be confident the behaviour would not change under me next month. Instead I shipped an architecture where the model is optional, every generated sentence is grounded in a fact sheet built from the user's own words, and the app degrades to deterministic text the moment anything looks wrong.

There is a quieter argument too. Running a small open model in-process meant no per-token cost, which meant I could stop optimising for API calls and just embed everything, rescore on every read, and re-rank freely. A metered API would have pushed me toward caching reflections and calling the model sparingly, and a reflection that is stale the moment you add a memory is a worse product. Open weights did not just make this more private. They made it better.

## My Agent Session

I built this with Claude Code. The useful parts of the session were not code generation. They were the times it pushed back on output I would have shipped:

- Catching that the reflection said *"2 hard things"* and *"1 heavy one"* two paragraphs apart, because "hard" was defined differently in two places. In an app whose only job is being trustworthy about your own life, one inconsistency like that destroys the whole thing.
- Catching *"10 memories across 10 chapters"*: technically true, completely vacuous, and a tell that nothing real was being computed.
- Measuring contrast instead of eyeballing it, and finding that white text on my accent colour was 2.74:1, a straight WCAG failure on the most prominent button in the app.
- Finding two bugs that only appear on a clean clone with `NODE_ENV=production`, both of which would have failed my first deploy.

[[ Optional: your DevRelay session link, or delete this section ]]

## Prize Categories

- **Best Use of Render**: one blueprint, one service, persistent disk, open-weight model running in-process on a starter instance with no inference bill at all.

---

### What they said

[[ Show it to them and put their actual reaction here. The rules give bonus points for demoing to the intended recipient, and honestly this is the only part of the post that proves the thing works. ]]

---

Remember is MIT licensed. If you want to build your own version of this for someone, the file to start with is `server/ai/anchors.js`. It is just sentences, and it decides everything the app is able to see in a person.
