import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CaretLeft, Plant, ArrowRight, Cpu, CaretRight } from '@phosphor-icons/react';
import { api } from '../lib/api';
import type { Reminder } from '../lib/types';
import { Empty, ErrorNote } from '../lib/ui';
import { useReveal } from '../lib/useReveal';

/**
 * The feature this whole app exists for. Someone opens this screen on a bad
 * day, so it is the one place where the design does the most work: a single
 * grounding statement fills the screen first, and the reasoning and receipts
 * sit below it for whenever they are ready to read.
 */
export default function RemindMe() {
  const nav = useNavigate();
  const reveal = useReveal();
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
    <div ref={reveal} className="stack-l">
      <div className="page-head stack-s" style={{ paddingBottom: 4 }}>
        <button className="back-link" onClick={() => nav(-1)}>
          <CaretLeft size={15} weight="bold" /> Back
        </button>
      </div>

      {loading && (
        <div
          className="statement stack center"
          style={{
            alignItems: 'center', padding: '56px 24px', gap: 16, minHeight: 260,
            justifyContent: 'center',
          }}
        >
          <div className="spinner" style={{ borderColor: 'currentColor', borderTopColor: 'var(--accent)', opacity: .9 }} />
          <p className="display" style={{ fontSize: 19 }}>Reading back through your memories</p>
          <p className="small" style={{ opacity: .6, maxWidth: '32ch' }}>
            This runs on your own server. Nothing is being sent anywhere.
          </p>
        </div>
      )}

      {error && <ErrorNote error={error} onRetry={load} />}

      {reminder?.empty && (
        <Empty
          icon={Plant}
          title={reminder.headline}
          body={reminder.paragraphs.join(' ')}
          action={<Link to="/capture" className="btn btn-accent">Add your first memory</Link>}
        />
      )}

      {reminder && !reminder.empty && (
        <>
          {/* --- the statement. One line, full bleed, nothing competing. --- */}
          {reminder.statements.length > 0 && (
            <section
              className="statement fade"
              style={{
                padding: '30px 24px 22px',
                minHeight: 268,
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                gap: 24,
              }}
            >
              <p
                key={card}
                className="display fade"
                style={{
                  fontSize: 'clamp(26px, 7.2vw, 34px)',
                  lineHeight: 1.16,
                  letterSpacing: '-.035em',
                  textWrap: 'balance',
                }}
              >
                {reminder.statements[card]}
              </p>

              <div className="spread">
                <div className="row" style={{ gap: 6 }} aria-hidden="true">
                  {reminder.statements.map((_, i) => (
                    <span
                      key={i}
                      style={{
                        width: i === card ? 20 : 6, height: 6, borderRadius: 99,
                        background: i === card ? 'var(--accent)' : 'currentColor',
                        opacity: i === card ? 1 : .24,
                        transition: 'width .34s var(--ease), opacity .34s',
                      }}
                    />
                  ))}
                </div>
                <button
                  className="btn btn-sm btn-accent"
                  onClick={() => setCard((c) => (c + 1) % reminder.statements.length)}
                  aria-label="Next statement"
                >
                  Next <CaretRight size={14} weight="bold" />
                </button>
              </div>
            </section>
          )}

          {/* --- the reasoning --- */}
          <article className="reveal stack" style={{ gap: 18 }}>
            <h1
              className="display"
              style={{ fontSize: 'clamp(23px, 6vw, 27px)', maxWidth: '20ch' }}
            >
              {reminder.headline}
            </h1>
            {reminder.paragraphs.map((p, i) => (
              <p
                key={i}
                style={{ fontSize: 16.5, lineHeight: 1.72, color: 'var(--ink-2)', maxWidth: '58ch' }}
              >
                {p}
              </p>
            ))}
          </article>

          {/* --- the receipts --- */}
          {reminder.evidence.proof.length > 0 && (
            <section className="reveal stack">
              <div className="stack-s">
                <h2 className="display" style={{ fontSize: 18 }}>The proof, in your own words</h2>
                <p className="small muted measure">
                  These are the memories that reflection was built from. Not a guess about
                  you, a record.
                </p>
              </div>
              <div style={{ borderTop: '1px solid var(--line)' }}>
                {reminder.evidence.proof.map((p) => (
                  <Link
                    key={p.id} to="/timeline"
                    className="row"
                    style={{
                      gap: 12, padding: '15px 2px', color: 'inherit',
                      textDecoration: 'none', borderBottom: '1px solid var(--line)',
                    }}
                  >
                    <span className="grow stack-s" style={{ gap: 3 }}>
                      <span style={{ fontWeight: 550, fontSize: 15 }}>{p.title}</span>
                      <span className="tiny muted-2">
                        {[p.time_period, p.category, p.feeling].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                    <CaretRight size={15} className="muted-2" />
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* --- what the model keeps finding --- */}
          {reminder.evidence.values.length > 0 && (
            <section className="reveal stack">
              <h2 className="display" style={{ fontSize: 18 }}>What keeps coming up</h2>
              <div className="stack" style={{ gap: 13 }}>
                {reminder.evidence.values.map((v, i) => (
                  <div key={v.id} className="stack-s" style={{ gap: 6 }}>
                    <div className="spread">
                      <span style={{ fontWeight: 550, fontSize: 14.5 }}>{v.label}</span>
                      <span className="tiny muted-2">
                        {v.memories} {v.memories === 1 ? 'memory' : 'memories'}
                      </span>
                    </div>
                    <div style={{ height: 5, borderRadius: 99, background: 'var(--line)', overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%', borderRadius: 99,
                          width: `${Math.min(100, (v.strength / (reminder.evidence.values[0].strength || 1)) * 100)}%`,
                          background: i === 0 ? 'var(--accent)' : 'var(--ink-3)',
                          transition: 'width .7s var(--ease)',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <div className="reveal row" style={{ gap: 10 }}>
            <button className="btn btn-ghost grow" onClick={load}>Say it again</button>
            <Link to="/explore" className="btn btn-primary grow" style={{ justifyContent: 'center' }}>
              Explore my story <ArrowRight size={15} weight="bold" />
            </Link>
          </div>

          {by && (
            <p className="tiny muted-2 center" style={{ lineHeight: 1.65, maxWidth: '44ch', margin: '0 auto' }}>
              <Cpu size={12} style={{ display: 'inline', verticalAlign: '-2px' }} />{' '}
              Written from your memories using <strong>{by.embedding}</strong>, running
              locally on your own server
              {by.llm ? <> and rewritten by <strong>{by.llm}</strong></> : null}.
              Open weights, no third-party API.
            </p>
          )}
        </>
      )}
    </div>
  );
}
