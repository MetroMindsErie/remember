import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import type { Lens, Story } from '../lib/types';
import { Empty, ErrorNote, Icons, RichParagraph, Spinner, type IconName } from '../lib/ui';

const GRADS = ['var(--grad-warm)', 'var(--grad-calm)', 'var(--grad-dusk)'];

export default function Explore() {
  const { lensId } = useParams();
  const nav = useNavigate();

  const [lenses, setLenses] = useState<Lens[]>([]);
  const [story, setStory] = useState<Story | null>(null);
  const [lens, setLens] = useState<Lens | null>(null);
  const [by, setBy] = useState<{ embedding: string; llm: string | null } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState<number | null>(null);

  useEffect(() => {
    api.lenses().then((r) => setLenses(r.lenses)).catch((e) => setError((e as Error).message));
    api.listMemories().then((r) => setTotal(r.count)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!lensId) { setStory(null); setLens(null); return; }
    setLoading(true);
    setError(null);
    api.story(lensId)
      .then((r) => { setStory(r.story); setLens(r.lens); setBy(r.generatedBy); })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [lensId]);

  /* ------------------------------------------------------------ lens menu */
  if (!lensId) {
    return (
      <div className="stack-l fade-in">
        <div className="page-head">
          <h1 className="serif">Explore My Story</h1>
          <p className="sub">
            Seven ways of reading the same life. Each one is written from your own memories.
          </p>
        </div>

        {total === 0 && (
          <Empty
            emoji="📖"
            title="Nothing to read yet"
            body="Save a few memories and every section here fills itself in from what you wrote."
            action={<Link to="/add" className="btn btn-accent">Add a memory</Link>}
          />
        )}

        {error && <ErrorNote error={error} />}

        <div className="stack">
          {lenses.map((l, i) => {
            const Icon = Icons[l.icon as IconName] ?? Icons.book;
            return (
              <Link
                key={l.id}
                to={`/explore/${l.id}`}
                className="card card-lg rise"
                style={{
                  display: 'flex', alignItems: 'center', gap: 15,
                  color: 'inherit', textDecoration: 'none', animationDelay: `${i * 50}ms`,
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 44, height: 44, flexShrink: 0, borderRadius: 14,
                    background: GRADS[i % GRADS.length], display: 'grid',
                    placeItems: 'center', color: '#4a2d18',
                  }}
                >
                  <span style={{ width: 21, height: 21, display: 'block' }}><Icon /></span>
                </span>
                <span className="grow stack-s" style={{ gap: 2 }}>
                  <span className="serif" style={{ fontSize: 17 }}>{l.label}</span>
                  <span className="small muted">{l.blurb}</span>
                </span>
                <span className="muted-2" aria-hidden="true">›</span>
              </Link>
            );
          })}
        </div>
      </div>
    );
  }

  /* ----------------------------------------------------------- one story */
  return (
    <div className="stack-l fade-in">
      <div className="page-head stack-s" style={{ paddingBottom: 8 }}>
        <button className="back-link" onClick={() => nav('/explore')}>
          <span style={{ width: 15, height: 15, display: 'block' }}><Icons.back /></span>
          All sections
        </button>
        <h1 className="serif">{lens?.label ?? story?.title ?? 'Your story'}</h1>
        {lens?.blurb && <p className="sub">{lens.blurb}</p>}
      </div>

      {loading && <Spinner label="Reading your memories…" />}
      {error && <ErrorNote error={error} />}

      {story && (
        <>
          {story.empty ? (
            <Empty
              emoji="📖"
              title="Not enough to go on yet"
              body={story.paragraphs[0]}
              action={<Link to="/add" className="btn btn-accent">Add a memory</Link>}
            />
          ) : (
            <article className="card card-lg stack" style={{ gap: 15, fontSize: 16, lineHeight: 1.68 }}>
              {story.paragraphs.map((p, i) => (
                <div key={i} style={{ color: 'var(--ink-2)' }}>
                  <RichParagraph text={p} />
                </div>
              ))}
            </article>
          )}

          {story.highlights.length > 0 && (
            <section className="stack">
              <h2 className="serif" style={{ fontSize: 17 }}>From your timeline</h2>
              <div className="stack-s">
                {story.highlights.map((h) => (
                  <Link
                    key={h.id} to="/timeline"
                    className="card card-flat row"
                    style={{ color: 'inherit', textDecoration: 'none', gap: 12 }}
                  >
                    <span className="grow stack-s" style={{ gap: 2 }}>
                      <span style={{ fontWeight: 600, fontSize: 15 }}>{h.title}</span>
                      <span className="tiny muted-2">
                        {[h.time_period, h.category, h.feeling].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                    <span className="muted-2" aria-hidden="true">›</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <div className="row-wrap" style={{ gap: 8 }}>
            {lenses.filter((l) => l.id !== lensId).slice(0, 4).map((l) => (
              <Link key={l.id} to={`/explore/${l.id}`} className="chip" style={{ textDecoration: 'none', color: 'var(--ink)' }}>
                {l.label}
              </Link>
            ))}
          </div>

          {by && (
            <p className="tiny muted-2 center" style={{ lineHeight: 1.6 }}>
              Generated from your memories with <strong>{by.embedding}</strong> running locally
              {by.llm ? <>, rewritten by <strong>{by.llm}</strong></> : null}.
            </p>
          )}
        </>
      )}
    </div>
  );
}
