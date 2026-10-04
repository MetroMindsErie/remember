import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import type { Lens, Story } from '../lib/types';
import { Empty, ErrorNote, Icons, RichParagraph, Spinner, type IconName } from '../lib/ui';
import { BookOpen, CaretRight } from '@phosphor-icons/react';

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
      <div className="stack-l fade">
        <div className="page-head">
          <h1 className="display">Explore My Story</h1>
          <p className="sub">
            Seven ways of reading the same life. Each one is written from your own memories.
          </p>
        </div>

        {total === 0 && (
          <Empty
            icon={BookOpen}
            title="Nothing to read yet"
            body="Save a few memories and every section here fills itself in from what you wrote."
            action={<Link to="/add" className="btn btn-accent">Add a memory</Link>}
          />
        )}

        {error && <ErrorNote error={error} />}

        {/* A hairline list rather than seven identical cards. Seven equal
            boxes is the repeated-card tell, and a menu of named sections
            reads faster as rows than as tiles. */}
        <div style={{ borderTop: '1px solid var(--line)' }}>
          {lenses.map((l, i) => {
            const Icon = Icons[l.icon as IconName] ?? Icons.book;
            return (
              <Link
                key={l.id}
                to={`/explore/${l.id}`}
                className="row rise"
                style={{
                  '--i': i,
                  gap: 15,
                  padding: '17px 2px',
                  color: 'inherit',
                  textDecoration: 'none',
                  borderBottom: '1px solid var(--line)',
                } as React.CSSProperties}
              >
                <Icon size={21} weight="light" className="muted-2" style={{ flexShrink: 0 }} />
                <span className="grow stack-s" style={{ gap: 2 }}>
                  <span className="display" style={{ fontSize: 16.5 }}>{l.label}</span>
                  <span className="small muted-2">{l.blurb}</span>
                </span>
                <CaretRight size={15} className="muted-2" style={{ flexShrink: 0 }} />
              </Link>
            );
          })}
        </div>
      </div>
    );
  }

  /* ----------------------------------------------------------- one story */
  return (
    <div className="stack-l fade">
      <div className="page-head stack-s" style={{ paddingBottom: 8 }}>
        <button className="back-link" onClick={() => nav('/explore')}>
          <span style={{ width: 15, height: 15, display: 'block' }}><Icons.back /></span>
          All sections
        </button>
        <h1 className="display">{lens?.label ?? story?.title ?? 'Your story'}</h1>
        {lens?.blurb && <p className="sub">{lens.blurb}</p>}
      </div>

      {loading && <Spinner label="Reading your memories…" />}
      {error && <ErrorNote error={error} />}

      {story && (
        <>
          {story.empty ? (
            <Empty
              icon={BookOpen}
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
              <h2 className="display" style={{ fontSize: 17 }}>From your timeline</h2>
              <div style={{ borderTop: '1px solid var(--line)' }}>
                {story.highlights.map((h) => (
                  <Link
                    key={h.id} to="/timeline"
                    className="row"
                    style={{
                      color: 'inherit', textDecoration: 'none', gap: 12,
                      padding: '14px 2px', borderBottom: '1px solid var(--line)',
                    }}
                  >
                    <span className="grow stack-s" style={{ gap: 2 }}>
                      <span style={{ fontWeight: 600, fontSize: 15 }}>{h.title}</span>
                      <span className="tiny muted-2">
                        {[h.time_period, h.category, h.feeling].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                    <CaretRight size={15} className="muted-2" />
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
