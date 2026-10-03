import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import type { Attachment, Facets, Storage } from '../lib/types';
import { CATEGORY_EMOJI, ErrorNote, Icons, feelingStyle } from '../lib/ui';
import { MediaPicker } from '../components/MediaPicker';

/**
 * Capture mode.
 *
 * The guided flow in Add Memory is for excavating something from years ago.
 * This is the opposite situation: you just got home from a day out, your phone
 * is full of it, and you want it in the timeline before you forget the details.
 * So the media comes first and everything else is one screen, optional, and
 * below the fold.
 */

const QUICK_WHEN = ['today', 'yesterday', 'this weekend', 'last week', 'last month'];

export default function Capture() {
  const nav = useNavigate();

  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [when, setWhen] = useState('today');
  const [people, setPeople] = useState('');
  const [place, setPlace] = useState('');
  const [category, setCategory] = useState('Other');
  const [feeling, setFeeling] = useState('Happy');
  const [tags, setTags] = useState('');
  const [meaning, setMeaning] = useState('');
  const [more, setMore] = useState(false);

  const [facets, setFacets] = useState<Facets | null>(null);
  const [storage, setStorage] = useState<Storage | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.facets().then(setFacets).catch(() => {});
    api.storage().then(setStorage).catch(() => {});
  }, []);

  // Leaving with uploaded files and no saved memory loses them (the server
  // sweeps them later), so it is worth one confirmation.
  useEffect(() => {
    const unsaved = attachments.length > 0 || title.trim() || text.trim();
    if (!unsaved) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [attachments.length, title, text]);

  const canSave = title.trim().length > 0 || attachments.length > 0;

  async function save() {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      const { memory } = await api.createMemory({
        title: title.trim() || defaultTitle(attachments, place),
        memory_text: text,
        meaning,
        time_period: when,
        people: people.split(',').map((s) => s.trim()).filter(Boolean),
        place,
        category,
        feeling,
        tags: tags.split(',').map((s) => s.trim().replace(/^#/, '')).filter(Boolean),
        attachments,
      });
      nav('/timeline', { state: { highlight: memory.id, saved: true } });
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  }

  const counts = {
    photo: attachments.filter((a) => a.kind === 'photo').length,
    video: attachments.filter((a) => a.kind === 'video').length,
    audio: attachments.filter((a) => a.kind === 'audio').length,
  };
  const fs = feelingStyle(feeling);

  return (
    <div className="stack-l fade-in">
      <div className="page-head stack-s" style={{ paddingBottom: 8 }}>
        <button className="back-link" onClick={() => nav(-1)}>
          <span style={{ width: 15, height: 15, display: 'block' }}><Icons.back /></span> Back
        </button>
        <h1 className="serif">Capture a moment</h1>
        <p className="sub">
          Drop in the photos and videos while it is still fresh, say what happened,
          and it lands on your timeline.
        </p>
      </div>

      {error && <ErrorNote error={error} />}

      {/* ---------------------------------------------------- media first */}
      <MediaPicker items={attachments} onChange={setAttachments} />

      {attachments.length > 0 && (
        <div className="row-wrap">
          {counts.photo > 0 && <span className="badge badge-time">📷 {counts.photo} {counts.photo === 1 ? 'photo' : 'photos'}</span>}
          {counts.video > 0 && <span className="badge badge-cat">🎬 {counts.video} {counts.video === 1 ? 'video' : 'videos'}</span>}
          {counts.audio > 0 && <span className="badge badge-feel">🎵 {counts.audio} audio</span>}
        </div>
      )}

      {/* ------------------------------------------------------ the words */}
      <div className="field">
        <label htmlFor="cap-title">What was this?</label>
        <input
          id="cap-title" className="input" value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Waldameer with the kids"
          maxLength={200}
        />
      </div>

      <div className="field">
        <label htmlFor="cap-text">What happened?</label>
        <textarea
          id="cap-text" className="textarea" value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Just how the day went. The bits you will want back in ten years — who said what, what went wrong, what you ate."
          rows={6}
        />
      </div>

      <div className="field">
        <label>When?</label>
        <div className="row-wrap">
          {QUICK_WHEN.map((w) => (
            <button key={w} type="button" className="chip" aria-pressed={when === w} onClick={() => setWhen(w)}>
              {w}
            </button>
          ))}
        </div>
        <input
          className="input" value={when} onChange={(e) => setWhen(e.target.value)}
          placeholder="today" aria-label="When this happened" style={{ marginTop: 6 }}
        />
      </div>

      <div className="field">
        <label>How did it feel?</label>
        <div className="row-wrap">
          {(facets?.feelings ?? []).slice(0, 8).map((f) => {
            const s = feelingStyle(f);
            const on = feeling === f;
            return (
              <button
                key={f} type="button" className="chip" aria-pressed={on}
                onClick={() => setFeeling(f)}
                style={on
                  ? { background: s.fg, borderColor: s.fg, color: '#fff' }
                  : { background: s.bg, borderColor: 'transparent', color: s.fg }}
              >
                <span aria-hidden="true">{s.emoji}</span> {f}
              </button>
            );
          })}
        </div>
      </div>

      {/* --------------------------------------------------- the optional */}
      <button
        type="button"
        className="btn btn-ghost btn-block"
        onClick={() => setMore((m) => !m)}
        aria-expanded={more}
      >
        {more ? 'Hide the rest' : 'Add who, where and why it matters'}
      </button>

      {more && (
        <div className="stack-l fade-in">
          <div className="field">
            <label htmlFor="cap-people">Who was there?</label>
            <input
              id="cap-people" className="input" value={people}
              onChange={(e) => setPeople(e.target.value)}
              placeholder="Milo, Jess" list="cap-people-list"
            />
            <datalist id="cap-people-list">
              {facets?.people.map((p) => <option key={p} value={p} />)}
            </datalist>
          </div>

          <div className="field">
            <label htmlFor="cap-place">Where?</label>
            <input
              id="cap-place" className="input" value={place}
              onChange={(e) => setPlace(e.target.value)}
              placeholder="Waldameer Park, Erie" list="cap-place-list"
            />
            <datalist id="cap-place-list">
              {facets?.places.map((p) => <option key={p} value={p} />)}
            </datalist>
          </div>

          <div className="field">
            <label>What kind of memory?</label>
            <div className="row-wrap">
              {(facets?.categories ?? []).map((c) => (
                <button
                  key={c} type="button" className="chip"
                  aria-pressed={category === c} onClick={() => setCategory(c)}
                >
                  <span aria-hidden="true">{CATEGORY_EMOJI[c] ?? '✨'}</span> {c}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label htmlFor="cap-meaning">Why does this one matter?</label>
            <textarea
              id="cap-meaning" className="textarea" value={meaning}
              onChange={(e) => setMeaning(e.target.value)}
              placeholder="Optional — but this is the part Remember reads back to you later."
              rows={4}
            />
          </div>

          <div className="field">
            <label htmlFor="cap-tags">Tags</label>
            <input
              id="cap-tags" className="input" value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="kids, summer, waldameer"
            />
          </div>
        </div>
      )}

      {/* -------------------------------------------------------- preview */}
      {canSave && (
        <div
          className="card card-lg stack-s"
          style={{ background: fs.bg, border: 0 }}
        >
          <span className="tiny" style={{ color: fs.fg, fontWeight: 700, letterSpacing: '.05em' }}>
            GOING ON YOUR TIMELINE
          </span>
          <p className="serif" style={{ fontSize: 18, color: fs.fg }}>
            {title.trim() || defaultTitle(attachments, place)}
          </p>
          <p className="small" style={{ color: fs.fg, opacity: .8 }}>
            {when || 'no date'} · {feeling}
            {attachments.length > 0 && ` · ${attachments.length} ${attachments.length === 1 ? 'file' : 'files'}`}
          </p>
        </div>
      )}

      <button className="btn btn-accent btn-block" onClick={save} disabled={!canSave || saving}>
        {saving ? <><span className="spinner" /> Saving…</> : 'Save to my timeline'}
      </button>

      {!canSave && (
        <p className="tiny muted-2 center">Add a file or a title and you can save.</p>
      )}

      {storage && storage.bytes > 0 && (
        <p className="tiny muted-2 center">
          {storage.pretty} of photos and video stored across {storage.files}{' '}
          {storage.files === 1 ? 'file' : 'files'}.
        </p>
      )}

      <div className="notice">
        <span style={{ width: 16, height: 16, flexShrink: 0, marginTop: 2 }}><Icons.lock /></span>
        <span>
          Files are stored on your own server, next to your memories. Nothing is uploaded
          anywhere else.{' '}
          <Link to="/add" style={{ fontWeight: 600 }}>Prefer the guided questions? →</Link>
        </span>
      </div>
    </div>
  );
}

/** A memory saved with files but no title still needs something readable. */
function defaultTitle(attachments: Attachment[], place: string) {
  if (place.trim()) return place.trim();
  const n = attachments.length;
  if (!n) return 'Untitled memory';
  const kinds = new Set(attachments.map((a) => a.kind));
  const noun = kinds.size > 1 ? 'moment' : kinds.has('video') ? 'video' : kinds.has('audio') ? 'recording' : 'photo';
  return n === 1 ? `A ${noun}` : `${n} ${noun}s`;
}
