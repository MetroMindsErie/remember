import { useRef, useState } from 'react';
import { api } from '../lib/api';
import type { Attachment } from '../lib/types';
import { Icons } from '../lib/ui';
import { Camera, FilmStrip, MusicNote, LinkSimple, Warning } from '@phosphor-icons/react';

/**
 * Picks photos, videos and audio, uploads them immediately, and lets each one
 * carry a caption.
 *
 * Uploading on pick rather than on save is deliberate: by the time somebody has
 * finished writing about a day out, their files are already on the server, so
 * pressing Save is instant instead of a 100MB wait. The cost is files on disk
 * for abandoned captures, which the server sweeps.
 */
export function MediaPicker({
  items, onChange, compact = false,
}: {
  items: Attachment[];
  onChange: (items: Attachment[]) => void;
  compact?: boolean;
}) {
  const pickRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [showLink, setShowLink] = useState(false);

  async function add(files: FileList | File[] | null) {
    const list = Array.from(files ?? []);
    if (!list.length) return;
    setBusy(true);
    setError(null);
    setProgress(0);
    try {
      const r = await api.uploadMedia(list, setProgress);
      onChange([...items, ...r.files]);
      if (r.rejected.length) {
        setError(r.rejected.map((x) => `${x.name}: ${x.reason}`).join(' · '));
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      setProgress(0);
      if (pickRef.current) pickRef.current.value = '';
      if (cameraRef.current) cameraRef.current.value = '';
    }
  }

  const update = (id: string, patch: Partial<Attachment>) =>
    onChange(items.map((a) => (a.id === id ? { ...a, ...patch } : a)));

  const remove = (id: string) => onChange(items.filter((a) => a.id !== id));

  /**
   * Link fallback. Uploading fails for all sorts of boring reasons. A file
   * that is too big, a flaky connection, a photo that only exists in a shared
   * album. Pasting a URL always works, so it is never a dead end.
   */
  function addLink() {
    const raw = linkUrl.trim();
    if (!raw) return;
    let url: URL;
    try {
      url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    } catch {
      setError('That does not look like a web address.');
      return;
    }
    const path = url.pathname.toLowerCase();
    const kind: Attachment['kind'] =
      /\.(jpe?g|png|gif|webp|avif|heic|bmp)$/.test(path) ? 'photo'
      : /\.(mp4|webm|mov|m4v)$/.test(path) ? 'video'
      : /\.(mp3|m4a|aac|wav|ogg|flac)$/.test(path) ? 'audio'
      : 'link';

    onChange([...items, {
      id: `link-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      kind,
      url: url.toString(),
      name: url.hostname.replace(/^www\./, '') + path.slice(0, 40),
      mime: '',
      size: 0,
      caption: '',
    }]);
    setLinkUrl('');
    setError(null);
  }

  const move = (id: string, dir: -1 | 1) => {
    const i = items.findIndex((a) => a.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div className="stack">
      <input
        ref={pickRef} type="file" multiple className="sr-only"
        accept="image/*,video/*,audio/*"
        onChange={(e) => add(e.target.files)}
        aria-label="Choose photos, videos or audio"
      />
      {/* `capture` opens the camera directly on a phone. */}
      <input
        ref={cameraRef} type="file" className="sr-only"
        accept="image/*,video/*" capture="environment"
        onChange={(e) => add(e.target.files)}
        aria-label="Take a photo or video"
      />

      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); add(e.dataTransfer.files); }}
        className="stack-s"
        style={{
          border: `2px dashed ${dragging ? 'var(--accent)' : 'var(--line)'}`,
          background: dragging ? 'var(--accent-soft)' : 'var(--surface-2)',
          borderRadius: 'var(--r-surface)',
          padding: compact ? '16px 14px' : '24px 16px',
          textAlign: 'center',
          alignItems: 'center',
          transition: 'all .18s var(--ease)',
        }}
      >
        {busy ? (
          <div className="stack-s" style={{ width: '100%', alignItems: 'center' }}>
            <div className="spinner" />
            <span className="small muted">Uploading… {progress}%</span>
            <div style={{ width: '100%', maxWidth: 260, height: 6, borderRadius: 99, background: 'var(--line)', overflow: 'hidden' }}>
              <div style={{ width: `${progress}%`, height: '100%', background: 'var(--accent)', transition: 'width .2s linear' }} />
            </div>
          </div>
        ) : (
          <>
            <Camera size={compact ? 24 : 30} weight="light" className="muted-2" aria-hidden="true" />
            {!compact && (
              <p className="small muted" style={{ maxWidth: 300 }}>
                Photos, videos, voice notes, whatever you have. Add them all at once.
              </p>
            )}
            <div className="row-wrap" style={{ justifyContent: 'center', marginTop: 2 }}>
              <button type="button" className="btn btn-sm" onClick={() => pickRef.current?.click()}>
                Choose files
              </button>
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => cameraRef.current?.click()}>
                Take one now
              </button>
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => setShowLink((v) => !v)}>
                Paste a link
              </button>
            </div>

            {showLink && (
              <div className="row fade" style={{ gap: 6, width: '100%', marginTop: 8 }}>
                <input
                  className="input grow"
                  style={{ fontSize: 14, padding: '9px 11px' }}
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLink(); } }}
                  placeholder="Image URL, YouTube, Spotify…"
                  aria-label="Media URL"
                />
                <button type="button" className="btn btn-sm" onClick={addLink}>Add</button>
              </div>
            )}
          </>
        )}
      </div>

      {error && (
        <div className="notice notice-error" role="alert">
          <Warning size={16} weight="fill" />
          <span className="grow">{error}</span>
        </div>
      )}

      {items.length > 0 && (
        <div className="stack-s">
          <div className="spread">
            <span className="tiny muted-2" style={{ fontWeight: 700, letterSpacing: '.05em' }}>
              {items.length} {items.length === 1 ? 'FILE' : 'FILES'}
            </span>
            <button type="button" className="btn-plain tiny muted-2" onClick={() => onChange([])}>
              Remove all
            </button>
          </div>

          {items.map((a, i) => (
            <div key={a.id} className="card card-flat stack-s" style={{ padding: 10 }}>
              <div className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
                <MediaThumb attachment={a} />
                <div className="grow stack-s" style={{ gap: 4, minWidth: 0 }}>
                  <span className="small" style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {a.name || a.kind}
                  </span>
                  <span className="tiny muted-2">
                    {/* A pasted link has no size; showing "1KB" for it is just wrong. */}
                    {a.kind}
                    {a.size > 0 && ` · ${a.size > 1024 * 1024
                      ? `${(a.size / 1024 / 1024).toFixed(1)}MB`
                      : `${Math.max(1, Math.round(a.size / 1024))}KB`}`}
                  </span>
                </div>
                <div className="row" style={{ gap: 2 }}>
                  <button
                    type="button" className="btn-plain muted-2" aria-label="Move earlier"
                    disabled={i === 0} onClick={() => move(a.id, -1)}
                    style={{ padding: 6, opacity: i === 0 ? .3 : 1 }}
                  >↑</button>
                  <button
                    type="button" className="btn-plain muted-2" aria-label="Move later"
                    disabled={i === items.length - 1} onClick={() => move(a.id, 1)}
                    style={{ padding: 6, opacity: i === items.length - 1 ? .3 : 1 }}
                  >↓</button>
                  <button
                    type="button" className="btn-plain" aria-label={`Remove ${a.name}`}
                    onClick={() => remove(a.id)}
                    style={{ padding: 6, color: 'var(--accent)' }}
                  >
                    <span style={{ width: 15, height: 15, display: 'block' }}><Icons.trash /></span>
                  </button>
                </div>
              </div>
              <input
                className="input"
                style={{ fontSize: 14, padding: '9px 11px' }}
                value={a.caption}
                onChange={(e) => update(a.id, { caption: e.target.value })}
                placeholder="Say something about this one…"
                aria-label={`Caption for ${a.name}`}
                maxLength={500}
              />
            </div>
          ))}
          <p className="tiny muted-2">
            Captions are searchable, they get read by the same model that reads your memories.
          </p>
        </div>
      )}
    </div>
  );
}

function MediaThumb({ attachment }: { attachment: Attachment }) {
  const box = {
    width: 54, height: 54, flexShrink: 0, borderRadius: 'var(--r-input)',
    background: 'var(--paper-2)', display: 'grid', placeItems: 'center',
    overflow: 'hidden', fontSize: 22,
  } as const;

  if (attachment.kind === 'photo') {
    return (
      <span style={box}>
        <img
          src={attachment.url} alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          loading="lazy"
        />
      </span>
    );
  }
  return (
    <span style={box} aria-hidden="true" className="muted-2">
      {attachment.kind === 'video' ? <FilmStrip size={20} />
        : attachment.kind === 'audio' ? <MusicNote size={20} />
        : <LinkSimple size={20} />}
    </span>
  );
}
