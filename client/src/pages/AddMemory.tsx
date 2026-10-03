import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import type { Facets } from '../lib/types';
import { CATEGORY_EMOJI, ErrorNote, Icons, Toast, feelingStyle } from '../lib/ui';

/**
 * Add Memory is deliberately a *guided* flow rather than one long form. Five
 * short steps, one question at a time, with only the title actually required —
 * so a half-remembered thing can still be saved instead of abandoned.
 */

type Draft = {
  title: string; memory_text: string; people: string; place: string;
  time_period: string; category: string; feeling: string; meaning: string;
  photo_url: string; video_url: string; music_url: string;
  attachment_url: string; tags: string; prompt: string;
};

const EMPTY: Draft = {
  title: '', memory_text: '', people: '', place: '', time_period: '',
  category: 'Other', feeling: 'Nostalgic', meaning: '', photo_url: '',
  video_url: '', music_url: '', attachment_url: '', tags: '', prompt: '',
};

const STEPS = [
  { key: 'what',  label: 'What happened' },
  { key: 'who',   label: 'Who & where' },
  { key: 'feel',  label: 'How it felt' },
  { key: 'why',   label: 'Why it matters' },
  { key: 'media', label: 'Add media' },
] as const;

const TIME_EXAMPLES = ['childhood', 'high school', '2018', 'age 16', 'Christmas 2020', 'last year'];

export default function AddMemory() {
  const nav = useNavigate();
  const location = useLocation() as { state?: { prompt?: string; category?: string; feeling?: string } };

  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [facets, setFacets] = useState<Facets | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  // Arriving from a prompt pre-fills the question, category and feeling so the
  // person starts from an answer rather than an empty row.
  useEffect(() => {
    const s = location.state;
    if (s?.prompt) {
      setDraft((d) => ({
        ...d,
        prompt: s.prompt!,
        category: s.category ?? d.category,
        feeling: s.feeling ?? d.feeling,
      }));
    }
  }, [location.state]);

  useEffect(() => { api.facets().then(setFacets).catch(() => {}); }, []);
  useEffect(() => { if (step === 0) titleRef.current?.focus(); }, [step]);

  // Toasts have to dismiss themselves or they sit on screen forever.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const canSave = draft.title.trim().length > 0;
  const isLast = step === STEPS.length - 1;
  const progress = useMemo(() => ((step + 1) / STEPS.length) * 100, [step]);

  async function handlePhoto(file: File) {
    setUploading(true);
    setError(null);
    try {
      const { url } = await api.uploadPhoto(file);
      set('photo_url', url);
      setToast('Photo added');
    } catch (e) {
      setError(
        `${(e as Error).message} You can paste an image URL instead — that always works.`
      );
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!canSave) { setStep(0); setError('A memory needs a title to find it again later.'); return; }
    setSaving(true);
    setError(null);
    try {
      const { memory } = await api.createMemory({
        ...draft,
        people: draft.people.split(',').map((s) => s.trim()).filter(Boolean),
        tags: draft.tags.split(',').map((s) => s.trim().replace(/^#/, '')).filter(Boolean),
      });
      nav('/timeline', { state: { highlight: memory.id, saved: true } });
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  }

  const fs = feelingStyle(draft.feeling);

  return (
    <div className="stack-l fade-in">
      <div className="page-head stack-s" style={{ paddingBottom: 10 }}>
        <button className="back-link" onClick={() => (step === 0 ? nav(-1) : setStep((s) => s - 1))}>
          <span style={{ width: 15, height: 15, display: 'block' }}><Icons.back /></span>
          {step === 0 ? 'Back' : STEPS[step - 1].label}
        </button>
        <h1 className="serif">{STEPS[step].label}</h1>
        {draft.prompt && (
          <p className="small" style={{ color: 'var(--accent)', fontStyle: 'italic' }}>
            “{draft.prompt}”
          </p>
        )}
      </div>

      {/* progress */}
      <div style={{ display: 'flex', gap: 5 }} aria-hidden="true">
        {STEPS.map((s, i) => (
          <div
            key={s.key}
            style={{
              height: 4, flex: 1, borderRadius: 99,
              background: i <= step ? 'var(--accent)' : 'var(--line)',
              transition: 'background .3s var(--ease)',
            }}
          />
        ))}
      </div>
      <span className="sr-only" aria-live="polite">
        Step {step + 1} of {STEPS.length}: {STEPS[step].label}, {Math.round(progress)}% through
      </span>

      {error && <ErrorNote error={error} />}

      {/* ----------------------------------------------------------- step 1 */}
      {step === 0 && (
        <div className="stack-l">
          <div className="field">
            <label htmlFor="title">What would you call this memory?</label>
            <input
              id="title" ref={titleRef} className="input" value={draft.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="Nana's kitchen on Sunday mornings"
              maxLength={200}
              onKeyDown={(e) => { if (e.key === 'Enter' && canSave) setStep(1); }}
            />
            <span className="help">However you would say it out loud. This is the only part you need.</span>
          </div>

          <div className="field">
            <label htmlFor="memory_text">What happened?</label>
            <textarea
              id="memory_text" className="textarea" value={draft.memory_text}
              onChange={(e) => set('memory_text', e.target.value)}
              placeholder="Write it like you are telling someone. The small details are the ones worth keeping — what you could smell, who said what, the radio being on."
              rows={7}
            />
          </div>

          <div className="field">
            <label htmlFor="time_period">When did this happen?</label>
            <input
              id="time_period" className="input" value={draft.time_period}
              onChange={(e) => set('time_period', e.target.value)}
              placeholder="high school"
              list="time-examples"
            />
            <datalist id="time-examples">
              {TIME_EXAMPLES.map((t) => <option key={t} value={t} />)}
            </datalist>
            <span className="help">
              However you remember it. “High school”, “2018”, “age 16” and “Christmas 2020”
              all work — Remember figures out where it goes on your timeline.
            </span>
            <div className="row-wrap" style={{ marginTop: 2 }}>
              {TIME_EXAMPLES.map((t) => (
                <button key={t} className="chip" type="button"
                        aria-pressed={draft.time_period === t}
                        onClick={() => set('time_period', t)}>
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------- step 2 */}
      {step === 1 && (
        <div className="stack-l">
          <div className="field">
            <label htmlFor="people">Who was involved?</label>
            <input
              id="people" className="input" value={draft.people}
              onChange={(e) => set('people', e.target.value)}
              placeholder="Nana, Mom, Marcus"
              list="people-list"
            />
            <datalist id="people-list">
              {facets?.people.map((p) => <option key={p} value={p} />)}
            </datalist>
            <span className="help">Separate names with commas. Use whatever you actually call them.</span>
            {facets && facets.people.length > 0 && (
              <div className="row-wrap" style={{ marginTop: 4 }}>
                {facets.people.slice(0, 10).map((p) => {
                  const current = draft.people.split(',').map((x) => x.trim()).filter(Boolean);
                  const on = current.includes(p);
                  return (
                    <button
                      key={p} type="button" className="chip" aria-pressed={on}
                      onClick={() => set('people',
                        (on ? current.filter((x) => x !== p) : [...current, p]).join(', ')
                      )}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="field">
            <label htmlFor="place">Where were you?</label>
            <input
              id="place" className="input" value={draft.place}
              onChange={(e) => set('place', e.target.value)}
              placeholder="Nana's house, Topeka"
              list="places-list"
            />
            <datalist id="places-list">
              {facets?.places.map((p) => <option key={p} value={p} />)}
            </datalist>
          </div>

          <div className="field">
            <label>What kind of memory is this?</label>
            <div className="row-wrap">
              {(facets?.categories ?? []).map((c) => (
                <button
                  key={c} type="button" className="chip"
                  aria-pressed={draft.category === c}
                  onClick={() => set('category', c)}
                >
                  <span aria-hidden="true">{CATEGORY_EMOJI[c] ?? '✨'}</span> {c}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------- step 3 */}
      {step === 2 && (
        <div className="stack-l">
          <div className="field">
            <label>What feeling is connected to this memory?</label>
            <span className="help">
              There is no wrong answer, and hard feelings belong here just as much as good ones.
            </span>
            <div className="row-wrap" style={{ marginTop: 6 }}>
              {(facets?.feelings ?? []).map((f) => {
                const s = feelingStyle(f);
                const on = draft.feeling === f;
                return (
                  <button
                    key={f} type="button" className="chip" aria-pressed={on}
                    onClick={() => set('feeling', f)}
                    style={on ? { background: s.fg, borderColor: s.fg, color: '#fff' } : { background: s.bg, borderColor: 'transparent', color: s.fg }}
                  >
                    <span aria-hidden="true">{s.emoji}</span> {f}
                  </button>
                );
              })}
            </div>
          </div>

          <div
            className="card card-lg center stack"
            style={{ background: fs.bg, border: 0, alignItems: 'center' }}
          >
            <div style={{ fontSize: 36 }} aria-hidden="true">{fs.emoji}</div>
            <p className="serif" style={{ fontSize: 18, color: fs.fg }}>
              {draft.title ? `“${draft.title}”` : 'This memory'} feels {draft.feeling.toLowerCase()}.
            </p>
          </div>

          <div className="field">
            <label htmlFor="tags">Tags</label>
            <input
              id="tags" className="input" value={draft.tags}
              onChange={(e) => set('tags', e.target.value)}
              placeholder="nana, sundays, bread"
            />
            <span className="help">Comma separated. Tags make your timeline searchable later.</span>
            {facets && facets.tags.length > 0 && (
              <div className="row-wrap" style={{ marginTop: 4 }}>
                {facets.tags.slice(0, 12).map((t) => {
                  const current = draft.tags.split(',').map((x) => x.trim()).filter(Boolean);
                  const on = current.includes(t);
                  return (
                    <button
                      key={t} type="button" className="chip" aria-pressed={on}
                      onClick={() => set('tags', (on ? current.filter((x) => x !== t) : [...current, t]).join(', '))}
                    >
                      #{t}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------- step 4 */}
      {step === 3 && (
        <div className="stack-l">
          <div
            className="card card-lg"
            style={{ background: 'var(--grad-dusk)', border: 0, color: '#2c2040' }}
          >
            <p className="serif" style={{ fontSize: 19 }}>
              This is the part that matters most.
            </p>
            <p className="small" style={{ opacity: .85, marginTop: 6 }}>
              Remember uses what you write here more than anything else to work out
              what you value — and it is what gets read back to you when you ask to
              be reminded who you are.
            </p>
          </div>

          <div className="field">
            <label htmlFor="meaning">Why does this memory matter?</label>
            <textarea
              id="meaning" className="textarea" value={draft.meaning}
              onChange={(e) => set('meaning', e.target.value)}
              placeholder="What it taught you, what it proves about you, or why you have kept hold of it."
              rows={6}
            />
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------- step 5 */}
      {step === 4 && (
        <div className="stack-l">
          <div className="field">
            <label>Photo</label>
            <span className="help">Optional. Stored on your own server, never uploaded anywhere else.</span>
            {draft.photo_url ? (
              <div className="stack-s">
                <img
                  src={draft.photo_url} alt="The photo you attached"
                  style={{ width: '100%', borderRadius: 14, maxHeight: 280, objectFit: 'cover' }}
                />
                <button className="btn btn-sm btn-ghost" onClick={() => set('photo_url', '')}>
                  Remove photo
                </button>
              </div>
            ) : (
              <div className="stack-s">
                <input
                  ref={fileRef} type="file" accept="image/*" className="sr-only"
                  id="photo-file"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhoto(f); }}
                />
                <button
                  className="btn btn-ghost btn-block" disabled={uploading}
                  onClick={() => fileRef.current?.click()}
                >
                  {uploading ? <><span className="spinner" /> Uploading…</> : 'Choose a photo'}
                </button>
                <input
                  className="input" value={draft.photo_url}
                  onChange={(e) => set('photo_url', e.target.value)}
                  placeholder="…or paste an image URL"
                  aria-label="Image URL"
                />
              </div>
            )}
          </div>

          <div className="field">
            <label htmlFor="music_url">Song</label>
            <input
              id="music_url" className="input" value={draft.music_url}
              onChange={(e) => set('music_url', e.target.value)}
              placeholder="https://open.spotify.com/track/…"
            />
            <span className="help">Spotify and Apple Music links play right inside the card.</span>
          </div>

          <div className="field">
            <label htmlFor="video_url">Video</label>
            <input
              id="video_url" className="input" value={draft.video_url}
              onChange={(e) => set('video_url', e.target.value)}
              placeholder="https://youtube.com/watch?v=…"
            />
          </div>

          <div className="field">
            <label htmlFor="attachment_url">Any other link</label>
            <input
              id="attachment_url" className="input" value={draft.attachment_url}
              onChange={(e) => set('attachment_url', e.target.value)}
              placeholder="https://…"
            />
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------- controls */}
      <div className="row" style={{ gap: 10, paddingTop: 4 }}>
        {!isLast ? (
          <>
            <button className="btn btn-primary grow" onClick={() => setStep((s) => s + 1)}>
              Continue
            </button>
            <button className="btn btn-ghost" onClick={save} disabled={!canSave || saving}>
              {saving ? <span className="spinner" /> : 'Save now'}
            </button>
          </>
        ) : (
          <button className="btn btn-accent btn-block" onClick={save} disabled={!canSave || saving}>
            {saving ? <><span className="spinner" /> Saving…</> : 'Save this memory'}
          </button>
        )}
      </div>

      {!canSave && (
        <p className="tiny muted-2 center">Give it a title and you can save at any point.</p>
      )}

      {toast && <Toast message={toast} />}
    </div>
  );
}
