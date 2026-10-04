import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Attachment } from '../lib/types';
import { embedUrl } from '../lib/embed';
import { CaretLeft, CaretRight } from '@phosphor-icons/react';
import { MusicNote, LinkSimple } from '@phosphor-icons/react';

/**
 * Shows a memory's files. Photos get a collage whose shape depends on how many
 * there are, videos and audio get real players, and tapping a photo opens it
 * full size.
 */
export function MediaGallery({ items, title }: { items: Attachment[]; title: string }) {
  const [lightbox, setLightbox] = useState<number | null>(null);

  const photos = items.filter((a) => a.kind === 'photo');
  const videos = items.filter((a) => a.kind === 'video');
  const audio = items.filter((a) => a.kind === 'audio');
  const links = items.filter((a) => a.kind === 'link');

  // Escape closes, arrows move. A lightbox without these is annoying.
  useEffect(() => {
    if (lightbox === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightbox(null);
      if (e.key === 'ArrowRight') setLightbox((i) => (i === null ? i : (i + 1) % photos.length));
      if (e.key === 'ArrowLeft') setLightbox((i) => (i === null ? i : (i - 1 + photos.length) % photos.length));
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [lightbox, photos.length]);

  if (!items.length) return null;

  // 1 photo fills the width, 2 sit side by side, 3+ use a square grid.
  const cols = photos.length === 1 ? 1 : photos.length === 2 ? 2 : 3;
  const shown = photos.slice(0, 6);
  const extra = photos.length - shown.length;

  return (
    <div className="stack-s">
      {photos.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 4, borderRadius: 'var(--r-input)', overflow: 'hidden' }}>
          {shown.map((p, i) => (
            <button
              key={p.id}
              onClick={() => setLightbox(i)}
              aria-label={p.caption || `Open photo ${i + 1} of ${photos.length}`}
              style={{
                padding: 0, border: 0, cursor: 'zoom-in', position: 'relative',
                background: 'var(--paper-2)',
                aspectRatio: cols === 1 ? '4 / 3' : '1 / 1',
                overflow: 'hidden',
              }}
            >
              <img
                src={p.url} alt={p.caption || `Photo from ${title}`} loading="lazy"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              {i === shown.length - 1 && extra > 0 && (
                <span
                  style={{
                    position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
                    background: 'rgba(20,14,10,.56)', color: '#fff',
                    fontSize: 20, fontWeight: 700,
                  }}
                >
                  +{extra}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {videos.map((v) => (
        <figure key={v.id} style={{ margin: 0 }} className="stack-s">
          <video
            src={v.url}
            controls
            preload="metadata"
            playsInline
            style={{ width: '100%', borderRadius: 'var(--r-input)', background: '#000', maxHeight: 420 }}
          />
          {v.caption && <figcaption className="tiny muted">{v.caption}</figcaption>}
        </figure>
      ))}

      {audio.map((a) => (
        <figure key={a.id} style={{ margin: 0 }} className="stack-s">
          <div className="card card-flat row" style={{ gap: 10, padding: 10 }}>
            <MusicNote size={19} className="muted-2" aria-hidden="true" />
            <div className="grow" style={{ minWidth: 0 }}>
              <audio src={a.url} controls preload="metadata" style={{ width: '100%' }} />
            </div>
          </div>
          {a.caption && <figcaption className="tiny muted">{a.caption}</figcaption>}
        </figure>
      ))}

      {links.map((l) => {
        const embed = embedUrl(l.url);
        if (embed) {
          return (
            <figure key={l.id} style={{ margin: 0 }} className="stack-s">
              {embed.kind === 'video' ? (
                <div style={{ position: 'relative', paddingTop: '56.25%', borderRadius: 'var(--r-input)', overflow: 'hidden' }}>
                  <iframe
                    src={embed.src} title={l.caption || l.name || 'Video'} loading="lazy" allowFullScreen
                    allow="accelerometer; clipboard-write; encrypted-media; picture-in-picture"
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
                  />
                </div>
              ) : (
                <iframe
                  src={embed.src} title={l.caption || l.name || 'Audio'} loading="lazy"
                  allow="encrypted-media; clipboard-write"
                  style={{ width: '100%', height: 152, border: 0, borderRadius: 'var(--r-input)' }}
                />
              )}
              {l.caption && <figcaption className="tiny muted">{l.caption}</figcaption>}
            </figure>
          );
        }
        return (
          <a
            key={l.id} href={l.url} target="_blank" rel="noopener noreferrer nofollow"
            className="card card-flat row" style={{ gap: 10, padding: 10, color: 'inherit', textDecoration: 'none' }}
          >
            <LinkSimple size={17} className="muted-2" aria-hidden="true" />
            <span className="grow small" style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {l.caption || l.name || l.url}
            </span>
            <span className="muted-2" aria-hidden="true">↗</span>
          </a>
        );
      })}

      {/*
        Rendered into document.body on purpose. The memory card carries a
        `rise` animation with fill-mode `both`, which leaves a stacking context
        on the card permanently, so a position:fixed overlay rendered inside it
        is trapped there and the bottom nav paints over the top of it. A portal
        is the only reliable fix.
      */}
      {lightbox !== null && photos[lightbox] && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label={photos[lightbox].caption || 'Photo'}
          onClick={() => setLightbox(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 80,
            background: 'rgba(12,9,7,.93)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            padding: 16, gap: 14,
          }}
        >
          <img
            src={photos[lightbox].url}
            alt={photos[lightbox].caption || `Photo from ${title}`}
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '100%', maxHeight: '74vh', objectFit: 'contain', borderRadius: 'var(--r-input)' }}
          />
          {photos[lightbox].caption && (
            <p className="small" style={{ color: '#f2e9df', textAlign: 'center', maxWidth: 520 }}>
              {photos[lightbox].caption}
            </p>
          )}
          <div className="row" style={{ gap: 10 }} onClick={(e) => e.stopPropagation()}>
            {photos.length > 1 && (
              <>
                <button
                  className="btn btn-sm"
                  onClick={() => setLightbox((i) => (i! - 1 + photos.length) % photos.length)}
                ><CaretLeft size={14} weight="bold" /> Prev</button>
                <span className="small" style={{ color: '#c0b2a6' }}>
                  {lightbox + 1} / {photos.length}
                </span>
                <button
                  className="btn btn-sm"
                  onClick={() => setLightbox((i) => (i! + 1) % photos.length)}
                >Next <CaretRight size={14} weight="bold" /></button>
              </>
            )}
            <button className="btn btn-sm btn-accent" onClick={() => setLightbox(null)}>Close</button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
