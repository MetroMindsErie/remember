import { useState } from 'react';
import type { Memory } from '../lib/types';
import { CategoryBadge, FeelingBadge, Icons, feelingStyle } from '../lib/ui';
import { MediaGallery } from './MediaGallery';
import { embedUrl, hostOf } from '../lib/embed';
import { User, MapPin, Sparkle } from '@phosphor-icons/react';

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
  const hasMedia = (memory.attachments?.length ?? 0) > 0;

  return (
    <article className="card card-lg card-raised stack rise" style={{ gap: 13, overflow: 'hidden' }}>
      {/* a thin emotional stripe, so the feeling reads before the words do */}
      {/* A hairline in the feeling's hue. Reads the emotional register of the
          card before a single word of it. */}
      <div
        aria-hidden="true"
        style={{ height: 3, margin: '-22px -22px 4px', background: s.fg, opacity: .9 }}
      />

      <div className="spread" style={{ alignItems: 'flex-start' }}>
        <div className="grow stack-s">
          <h3 className="display" style={{ fontSize: 19, letterSpacing: '-.028em' }}>{memory.title}</h3>
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
          <span
            className="badge"
            style={{ background: 'var(--accent-soft)', color: 'var(--accent-ink)' }}
            title="Found by meaning, not by matching words"
          >
            <Sparkle size={12} weight="fill" /> by meaning
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

      {memory.attachments?.length > 0 && (
        <MediaGallery items={memory.attachments} title={memory.title} />
      )}

      {memory.photo_url && (
        <img
          src={memory.photo_url}
          alt={`Photo from the memory “${memory.title}”`}
          loading="lazy"
          style={{
            width: '100%', borderRadius: 'var(--r-input)', maxHeight: 340,
            objectFit: 'cover', background: 'var(--paper-2)',
          }}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />
      )}

      {(memory.people.length > 0 || memory.place) && (
        <div className="row-wrap small">
          {memory.people.map((p) => (
            <button key={p} className="chip" onClick={() => onFilter?.('person', p)}>
              <User size={13} /> {p}
            </button>
          ))}
          {memory.place && (
            <button className="chip" onClick={() => onFilter?.('place', memory.place)}>
              <MapPin size={13} /> {memory.place}
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
                padding: 14, borderRadius: 'var(--r-input)',
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
            <div style={{ position: 'relative', paddingTop: '56.25%', borderRadius: 'var(--r-input)', overflow: 'hidden' }}>
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
              style={{ width: '100%', height: music.kind === 'audio' ? 152 : 200, border: 0, borderRadius: 'var(--r-input)' }}
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
        {(hasBody || hasMedia || music || video || memory.attachment_url) ? (
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
                style={{ background: 'var(--accent)', color: '#fff', borderColor: 'transparent' }}
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
