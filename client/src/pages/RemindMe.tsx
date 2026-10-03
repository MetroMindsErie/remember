import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import type { Reminder } from '../lib/types';
import { Empty, ErrorNote, Icons } from '../lib/ui';

/**
 * The feature this whole app exists for. Someone opens this screen on a bad
 * day, and it reads their own evidence back to them.
 */
export default function RemindMe() {
  const nav = useNavigate();
  const [reminder, setReminder] = useState<Reminder | null>(null);
  const [by, setBy] = useState<{ embedding: string; llm: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [card, setCard] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api.reminder();
      setReminder(r.reminder);
      setBy(r.generatedBy);
      setCard(0);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="stack-l fade-in">
      <div className="page-head stack-s" style={{ paddingBottom: 8 }}>
        <button className="back-link" onClick={() => nav(-1)}>
          <span style={{ width: 15, height: 15, display: 'block' }}><Icons.back /></span> Back
        </button>
        <h1 className="serif">Remind Me Who I Am</h1>
      </div>

      {loading && (
        <div
          className="card card-lg center stack"
          style={{ background: 'var(--grad-dusk)', border: 0, alignItems: 'center', padding: '44px 22px', color: '#2c2040' }}
        >
          <div className="spinner" style={{ borderTopColor: '#2c2040' }} />
          <p className="serif" style={{ fontSize: 18 }}>Reading back through your memories…</p>
          <p className="small" style={{ opacity: .75 }}>This runs on your own server. Nothing is being sent anywhere.</p>
        </div>
      )}

      {error && <ErrorNote error={error} onRetry={load} />}

      {reminder?.empty && (
        <Empty
          emoji="🌱"
          title={reminder.headline}
          body={reminder.paragraphs.join(' ')}
          action={<Link to="/add" className="btn btn-accent">Add your first memory</Link>}
        />
      )}

      {reminder && !reminder.empty && (
        <>
          {/* the statement card stack — one grounding line at a time */}
          {reminder.statements.length > 0 && (
            <div
              className="card card-lg stack"
              style={{
                background: 'var(--grad-dusk)', border: 0, color: '#2c2040',
                minHeight: 180, justifyContent: 'space-between',
              }}
            >
              <p
                key={card}
                className="serif fade-in"
                style={{ fontSize: 24, lineHeight: 1.3 }}
              >
                {reminder.statements[card]}
              </p>
              <div className="spread">
                <div className="row" style={{ gap: 5 }} aria-hidden="true">
                  {reminder.statements.map((_, i) => (
                    <span
                      key={i}
                      style={{
                        width: i === card ? 18 : 6, height: 6, borderRadius: 99,
                        background: '#2c2040', opacity: i === card ? .9 : .3,
                        transition: 'all .3s var(--ease)',
                      }}
                    />
                  ))}
                </div>
                <button
                  className="btn btn-sm"
                  style={{ background: '#2c2040', color: '#fff', borderColor: 'transparent' }}
                  onClick={() => setCard((c) => (c + 1) % reminder.statements.length)}
                >
                  Next →
                </button>
              </div>
            </div>
          )}

          {/* the reflection */}
          <article className="card card-lg stack" style={{ gap: 16 }}>
            <h2 className="serif" style={{ fontSize: 21 }}>{reminder.headline}</h2>
            {reminder.paragraphs.map((p, i) => (
              <p key={i} style={{ fontSize: 16.5, lineHeight: 1.68, color: 'var(--ink-2)' }}>{p}</p>
            ))}
          </article>

          {/* the receipts */}
          {reminder.evidence.proof.length > 0 && (
            <section className="stack">
              <h2 className="serif" style={{ fontSize: 17 }}>The proof, in your own words</h2>
              <p className="small muted">
                These are the memories that reflection was built from. Not a guess about you — a record.
              </p>
              <div className="stack-s">
                {reminder.evidence.proof.map((p) => (
                  <Link
                    key={p.id} to="/timeline"
                    className="card card-flat row"
                    style={{ color: 'inherit', textDecoration: 'none', gap: 12 }}
                  >
                    <span className="grow stack-s" style={{ gap: 2 }}>
                      <span style={{ fontWeight: 600, fontSize: 15 }}>{p.title}</span>
                      <span className="tiny muted-2">
                        {[p.time_period, p.category, p.feeling].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                    <span className="muted-2" aria-hidden="true">›</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* what it found */}
          {reminder.evidence.values.length > 0 && (
            <section className="card card-lg stack">
              <h2 className="serif" style={{ fontSize: 17 }}>What keeps coming up</h2>
              <div className="stack-s">
                {reminder.evidence.values.map((v) => (
                  <div key={v.id} className="stack-s" style={{ gap: 4 }}>
                    <div className="spread">
                      <span style={{ fontWeight: 600, fontSize: 14.5 }}>{v.label}</span>
                      <span className="tiny muted-2">
                        {v.memories} {v.memories === 1 ? 'memory' : 'memories'}
                      </span>
                    </div>
                    <div style={{ height: 6, borderRadius: 99, background: 'var(--line)', overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%', borderRadius: 99,
                          width: `${Math.min(100, (v.strength / (reminder.evidence.values[0].strength || 1)) * 100)}%`,
                          background: 'var(--grad-warm)',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <div className="row" style={{ gap: 10 }}>
            <button className="btn btn-ghost grow" onClick={load}>Say it again</button>
            <Link to="/explore" className="btn btn-primary grow" style={{ justifyContent: 'center' }}>
              Explore my story
            </Link>
          </div>

          {by && (
            <p className="tiny muted-2 center" style={{ lineHeight: 1.6 }}>
              <span style={{ width: 12, height: 12, display: 'inline-block', verticalAlign: '-2px' }}>
                <Icons.cpu />
              </span>{' '}
              Written from your memories using <strong>{by.embedding}</strong>, running locally on your
              own server
              {by.llm ? <> and rewritten by <strong>{by.llm}</strong></> : null}.
              Open weights, no third-party API.
            </p>
          )}
        </>
      )}
    </div>
  );
}
