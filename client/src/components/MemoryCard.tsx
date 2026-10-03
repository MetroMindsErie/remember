import { useState } from 'react';
import type { Memory } from '../lib/types';
import { CategoryBadge, FeelingBadge, Icons, feelingStyle } from '../lib/ui';

/** Turns a music/video URL into an embed when we recognise the host. */
function embedUrl(raw: string): { src: string; kind: 'video' | 'audio' } | null {
  try {
    const u = new URL(raw);
    const host = u.hostname.replace(/^www\./, '');

    if (host === 'youtube.com' || host === 'm.youtube.com') {
      const v = u.searchParams.get('v');
      if (v) return { src: `https://www.youtube.com/embed/${v}`, kind: 'video' };
      if (u.pathname.startsWith('/shorts/')) {
        return { src: `https://www.youtube.com/embed/${u.pathname.split('/')[2]}`, kind: 'video' };
      }
    }
    if (host === 'youtu.be') {
      return { src: `https://www.youtube.com/embed${u.pathname}`, kind: 'video' };
    }
    if (host === 'open.spotify.com') {
      return { src: `https://open.spotify.com/embed${u.pathname}`, kind: 'audio' };
    }
    if (host === 'vimeo.com') {
      return { src: `https://player.vimeo.com/video${u.pathname}`, kind: 'video' };
    }
    if (host === 'music.apple.com') {
      return { src: `https://embed.music.apple.com${u.pathname}${u.search}`, kind: 'audio' };
    }
    return null;
  } catch {
    return null;
  }
}

function hostOf(raw: string) {
  try { return new URL(raw).hostname.replace(/^www\./, ''); } catch { return raw; }
}

function MediaLink({ url, icon, label }: { url: string; icon: JSX.Element; label: string }) {
  return (
    <a
      className="chip"
      href={url}
      target="_blank"
      rel="noopener noreferrer nofollow"
      style={{ textDecoration: 'none', color: 'var(--ink)' }}
    >
      <span style={{ width: 16, height: 16, display: 'grid', placeItems: 'center' }}>{icon}</span>
      {label}
      <span className="muted-2 tiny">{hostOf(url)}</span>
    </a>
  );
}

export function MemoryCard({
  memory, onDelete, onFilter, defaultOpen = false,
}: {
  memory: Memory;
  onDelete?: (id: string) => void;
  onFilter?: (key: 'person' | 'tag' | 'category' | 'feeling' | 'place', value: string) => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [confirming, setConfirming] = useState(false);
  const s = feelingStyle(memory.feeling);

  const music = memory.music_url ? embedUrl(memory.music_url) : null;
  const video = memory.video_url ? embedUrl(memory.video_url) : null;
  const hasBody = Boolean(memory.memory_text || memory.meaning);

  return (
    <article className="card card-lg stack rise" style={{ gap: 12, overflow: 'hidden' }}>
      {/* a thin emotional stripe, so the feeling reads before the words do */}
      <div
        aria-hidden="true"
        style={{
          height: 4, margin: '-20px -20px 2px', background: s.fg, opacity: .85,
        }}
      />

      <div className="spread" style={{ alignItems: 'flex-start' }}>
        <div className="grow stack-s">
          <h3 className="serif" style={{ fontSize: 19.5 }}>{memory.title}</h3>
          {memory.time_period && (
            <div className="row small muted" style={{ gap: 6 }}>
              <span>{memory.time_period}</span>
              {memory.chapter && memory.chapter !== memory.time_period && (
                <span className="muted-2">· {memory.chapter}</span>
              )}
            </div>
          )}
        </div>
        {memory._search && memory._search.matchedOn === 'meaning' && (
          <span className="badge badge-time" title="Found by meaning, not by matching words">
            ✦ by meaning
          </span>
        )}
      </div>

      <div className="row-wrap">
        <button className="btn-plain" style={{ padding: 0 }} onClick={() => onFilter?.('category', memory.category)}>
          <CategoryBadge category={memory.category} />
        </button>
        <button className="btn-plain" style={{ padding: 0 }} onClick={() => onFilter?.('feeling', memory.feeling)}>
          <FeelingBadge feeling={memory.feeling} />
        </button>
      </div>

      {memory.photo_url && (
        <img
          src={memory.photo_url}
          alt={`Photo from the memory “${memory.title}”`}
          loading="lazy"
          style={{
            width: '100%', borderRadius: 14, maxHeight: 340,
            objectFit: 'cover', background: 'var(--paper-2)',
          }}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />
      )}

      {(memory.people.length > 0 || memory.place) && (
        <div className="row-wrap small">
          {memory.people.map((p) => (
            <button key={p} className="chip" onClick={() => onFilter?.('person', p)}>
              <span aria-hidden="true">🧍</span> {p}
            </button>
          ))}
          {memory.place && (
            <button className="chip" onClick={() => onFilter?.('place', memory.place)}>
              <span aria-hidden="true">📍</span> {memory.place}
            </button>
          )}
        </div>
      )}

      {hasBody && (
        <>
          <p
            className="muted"
            style={{
              fontSize: 15, whiteSpace: 'pre-wrap',
              display: open ? 'block' : '-webkit-box',
              WebkitLineClamp: open ? 'unset' : 4,
              WebkitBoxOrient: 'vertical',
              overflow: open ? 'visible' : 'hidden',
            }}
          >
            {memory.memory_text}
          </p>

          {open && memory.meaning && (
            <div
              className="stack-s"
              style={{
                padding: 14, borderRadius: 14,
                background: s.bg, borderLeft: `3px solid ${s.fg}`,
              }}
            >
              <span className="tiny" style={{ color: s.fg, fontWeight: 700, letterSpacing: '.04em' }}>
                WHY IT MATTERS
              </span>
              <p style={{ fontSize: 14.5, whiteSpace: 'pre-wrap' }}>{memory.meaning}</p>
            </div>
          )}
        </>
      )}

      {open && (music || video) && (
        <div className="stack-s">
          {video && (
            <div style={{ position: 'relative', paddingTop: '56.25%', borderRadius: 14, overflow: 'hidden' }}>
              <iframe
                src={video.src}
                title={`Video for ${memory.title}`}
                allow="accelerometer; clipboard-write; encrypted-media; picture-in-picture"
                allowFullScreen
                loading="lazy"
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
              />
            </div>
          )}
          {music && (
            <iframe
              src={music.src}
              title={`Music for ${memory.title}`}
              allow="encrypted-media; clipboard-write"
              loading="lazy"
              style={{ width: '100%', height: music.kind === 'audio' ? 152 : 200, border: 0, borderRadius: 14 }}
            />
          )}
        </div>
      )}

      {open && (
        <div className="row-wrap">
          {memory.music_url && !music && <MediaLink url={memory.music_url} icon={<Icons.music />} label="Song" />}
          {memory.video_url && !video && <MediaLink url={memory.video_url} icon={<Icons.video />} label="Video" />}
          {memory.attachment_url && <MediaLink url={memory.attachment_url} icon={<Icons.link />} label="Link" />}
        </div>
      )}

      {memory.tags.length > 0 && (
        <div className="row-wrap">
          {memory.tags.map((t) => (
            <button key={t} className="btn-plain" style={{ padding: 0 }} onClick={() => onFilter?.('tag', t)}>
              <span className="badge badge-tag">{t}</span>
            </button>
          ))}
        </div>
      )}

      {open && memory.prompt && (
        <p className="tiny muted-2" style={{ fontStyle: 'italic' }}>
          Answered the prompt: “{memory.prompt}”
        </p>
      )}

      <div className="spread" style={{ borderTop: '1px solid var(--line-2)', paddingTop: 10, marginTop: 2 }}>
        {(hasBody || music || video || memory.attachment_url) ? (
          <button className="btn btn-sm btn-ghost" onClick={() => setOpen((o) => !o)}>
            {open ? 'Show less' : 'Read more'}
          </button>
        ) : <span />}

        {onDelete && (
          confirming ? (
            <div className="row" style={{ gap: 6 }}>
              <button className="btn btn-sm btn-ghost" onClick={() => setConfirming(false)}>Keep</button>
              <button
                className="btn btn-sm"
                style={{ background: 'var(--rose)', color: '#fff', borderColor: 'transparent' }}
                onClick={() => onDelete(memory.id)}
              >
                Delete for good
              </button>
            </div>
          ) : (
            <button
              className="btn-plain muted-2"
              onClick={() => setConfirming(true)}
              aria-label={`Delete the memory “${memory.title}”`}
              style={{ width: 34, height: 34, display: 'grid', placeItems: 'center' }}
            >
              <span style={{ width: 17, height: 17, display: 'block' }}><Icons.trash /></span>
            </button>
          )
        )}
      </div>
    </article>
  );
}
