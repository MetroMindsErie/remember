import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import type { Insights as InsightsData, Tally } from '../lib/types';
import { CATEGORY_EMOJI, Empty, ErrorNote, Icons, Spinner, feelingStyle } from '../lib/ui';

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="card stack-s" style={{ gap: 2, padding: '14px 15px' }}>
      <span className="tiny muted-2" style={{ fontWeight: 700, letterSpacing: '.05em' }}>
        {label.toUpperCase()}
      </span>
      <span className="serif" style={{ fontSize: 24, lineHeight: 1.15 }}>{value}</span>
      {sub && <span className="tiny muted-2">{sub}</span>}
    </div>
  );
}

function Bars({ items, color }: { items: Tally[]; color?: (label: string) => string }) {
  const max = Math.max(...items.map((i) => i.count), 1);
  return (
    <div className="stack-s">
      {items.map((i) => (
        <div key={i.label} className="stack-s" style={{ gap: 3 }}>
          <div className="spread">
            <span className="small" style={{ fontWeight: 500 }}>{i.label}</span>
            <span className="tiny muted-2">{i.count}</span>
          </div>
          <div style={{ height: 7, borderRadius: 99, background: 'var(--line)', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%', borderRadius: 99,
                width: `${(i.count / max) * 100}%`,
                background: color ? color(i.label) : 'var(--grad-warm)',
                transition: 'width .5s var(--ease)',
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Insights() {
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.insights()
      .then(setData)
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <><div className="page-head"><h1 className="serif">Insights</h1></div><Spinner /></>;
  if (error) return <><div className="page-head"><h1 className="serif">Insights</h1></div><ErrorNote error={error} /></>;
  if (!data) return null;

  if (data.total === 0) {
    return (
      <div className="stack-l fade-in">
        <div className="page-head"><h1 className="serif">Insights</h1></div>
        <Empty
          emoji="📊"
          title="No patterns yet"
          body="Insights are built entirely from your saved memories. Add a few and this fills in."
          action={<Link to="/add" className="btn btn-accent">Add a memory</Link>}
        />
      </div>
    );
  }

  const mediaTotal = data.media.photos + data.media.music + data.media.video + data.media.links;

  return (
    <div className="stack-l fade-in">
      <div className="page-head">
        <h1 className="serif">Insights</h1>
        <p className="sub">Patterns across everything you have saved.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Stat label="Memories" value={data.total} />
        <Stat
          label="Most common feeling"
          value={data.topFeeling ? `${feelingStyle(data.topFeeling.label).emoji} ${data.topFeeling.label}` : '—'}
          sub={data.topFeeling ? `in ${data.topFeeling.count} ${data.topFeeling.count === 1 ? 'memory' : 'memories'}` : undefined}
        />
        <Stat
          label="Most common category"
          value={data.topCategory ? `${CATEGORY_EMOJI[data.topCategory.label] ?? '✨'} ${data.topCategory.label}` : '—'}
          sub={data.topCategory ? `${data.topCategory.count} saved` : undefined}
        />
        <Stat
          label="With photos"
          value={data.media.photos}
          sub={`${mediaTotal} with media or links`}
        />
      </div>

      {/* the emotional balance — stated carefully, never as a score */}
      <section className="card card-lg stack">
        <h2 className="serif" style={{ fontSize: 17 }}>The shape of what you have saved</h2>
        <div style={{ display: 'flex', height: 12, borderRadius: 99, overflow: 'hidden', background: 'var(--line)' }}>
          {data.arc.positive > 0 && (
            <div style={{ width: `${(data.arc.positive / data.total) * 100}%`, background: 'var(--gold)' }} />
          )}
          {data.arc.neutral > 0 && (
            <div style={{ width: `${(data.arc.neutral / data.total) * 100}%`, background: 'var(--teal)' }} />
          )}
          {data.arc.hard > 0 && (
            <div style={{ width: `${(data.arc.hard / data.total) * 100}%`, background: 'var(--violet)' }} />
          )}
        </div>
        <div className="row-wrap small muted">
          <span className="row" style={{ gap: 5 }}>
            <span style={{ width: 9, height: 9, borderRadius: 99, background: 'var(--gold)' }} /> {data.arc.positive} good
          </span>
          <span className="row" style={{ gap: 5 }}>
            <span style={{ width: 9, height: 9, borderRadius: 99, background: 'var(--teal)' }} /> {data.arc.neutral} in between
          </span>
          <span className="row" style={{ gap: 5 }}>
            <span style={{ width: 9, height: 9, borderRadius: 99, background: 'var(--violet)' }} /> {data.arc.hard} hard
          </span>
        </div>
        <p className="small muted-2">
          Both belong in a life. This is not a score, and there is no number here you are
          supposed to be improving.
        </p>
      </section>

      {data.values.length > 0 && (
        <section className="card card-lg stack">
          <div className="stack-s">
            <h2 className="serif" style={{ fontSize: 17 }}>Themes in your own words</h2>
            <p className="small muted">
              Found by running your memories through an open-weight model on this server —
              not from a questionnaire.
            </p>
          </div>
          <Bars items={data.values.map((v) => ({ label: v.label, count: v.memories }))} />
        </section>
      )}

      {data.people.length > 0 && (
        <section className="card card-lg stack">
          <h2 className="serif" style={{ fontSize: 17 }}>Most mentioned people</h2>
          <Bars items={data.people} color={() => 'var(--grad-dusk)'} />
        </section>
      )}

      {data.feelings.length > 0 && (
        <section className="card card-lg stack">
          <h2 className="serif" style={{ fontSize: 17 }}>Feelings</h2>
          <Bars items={data.feelings} color={(l) => feelingStyle(l).fg} />
        </section>
      )}

      {data.categories.length > 0 && (
        <section className="card card-lg stack">
          <h2 className="serif" style={{ fontSize: 17 }}>Categories</h2>
          <Bars items={data.categories} color={() => 'var(--violet)'} />
        </section>
      )}

      {data.chapters.length > 0 && (
        <section className="card card-lg stack">
          <h2 className="serif" style={{ fontSize: 17 }}>Most active time periods</h2>
          <Bars items={data.chapters.slice(0, 8)} color={() => 'var(--teal)'} />
        </section>
      )}

      {data.tags.length > 0 && (
        <section className="card card-lg stack">
          <h2 className="serif" style={{ fontSize: 17 }}>Most common tags</h2>
          <div className="row-wrap">
            {data.tags.map((t) => (
              <span key={t.label} className="badge badge-tag">
                {t.label} <span className="muted-2">{t.count}</span>
              </span>
            ))}
          </div>
        </section>
      )}

      {data.places.length > 0 && (
        <section className="card card-lg stack">
          <h2 className="serif" style={{ fontSize: 17 }}>Places</h2>
          <div className="row-wrap">
            {data.places.map((p) => (
              <span key={p.label} className="badge badge-time">📍 {p.label} <span style={{ opacity: .6 }}>{p.count}</span></span>
            ))}
          </div>
        </section>
      )}

      <section className="card card-flat stack-s">
        <div className="row" style={{ gap: 8 }}>
          <span style={{ width: 15, height: 15, color: 'var(--ink-3)' }}><Icons.cpu /></span>
          <h2 className="serif" style={{ fontSize: 15 }}>What is running</h2>
        </div>
        <p className="tiny muted" style={{ lineHeight: 1.65 }}>
          <strong>Embeddings:</strong> {data.ai.embedding.model} — {data.ai.embedding.state}
          {data.ai.vectors > 0 && <> ({data.ai.vectors} {data.ai.vectors === 1 ? 'memory' : 'memories'} indexed)</>}.
          Open weights, running locally on this server.
          <br />
          <strong>Language model:</strong>{' '}
          {data.ai.llm.configured
            ? <>{data.ai.llm.model} at {data.ai.llm.endpoint}{data.ai.llm.local ? ' (on your machine)' : ''}</>
            : 'none configured — reflections are written by the built-in composer'}.
        </p>
        <Link to="/settings" className="small" style={{ fontWeight: 600 }}>Settings & privacy →</Link>
      </section>
    </div>
  );
}
