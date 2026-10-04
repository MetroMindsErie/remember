import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Camera, ListDashes, Compass, BookOpen, ChartBar, Lock, ArrowRight } from '@phosphor-icons/react';
import { api } from '../lib/api';
import { useReveal } from '../lib/useReveal';
import type { Insights } from '../lib/types';

/**
 * Home.
 *
 * Deliberately not five identical rows. The actions are not equal in weight:
 * Capture is what someone does weekly, Remind Me Who I Am is what they open on
 * the worst day of the month. The bento gives each one the footprint it earns,
 * five items in exactly five cells.
 */
export default function Home() {
  const reveal = useReveal();
  const [stats, setStats] = useState<Insights | null>(null);
  const [prompt, setPrompt] = useState<{ text: string; hint: string } | null>(null);

  useEffect(() => {
    api.insights().then(setStats).catch(() => {});
    api.prompts()
      .then(({ prompts }) => {
        const open = prompts.filter((p) => !p.answered);
        const pool = open.length ? open : prompts;
        const pick = pool[Math.floor(Math.random() * pool.length)];
        if (pick) setPrompt({ text: pick.text, hint: pick.hint });
      })
      .catch(() => {});
  }, []);

  const total = stats?.total ?? null;
  const isEmpty = total === 0;

  return (
    <div ref={reveal} className="stack-l" style={{ paddingTop: 40 }}>
      {/* ---------------------------------------------------------- masthead */}
      <header className="fade">
        <h1
          className="display"
          style={{ fontSize: 'clamp(46px, 15vw, 68px)', letterSpacing: '-.045em' }}
        >
          Remember
        </h1>
        <p
          style={{
            fontSize: 'clamp(17px, 4.6vw, 20px)',
            color: 'var(--ink-2)',
            marginTop: 10,
            maxWidth: '22ch',
            lineHeight: 1.35,
          }}
        >
          Reconnect with who you are.
        </p>

        {total !== null && total > 0 && stats && (
          <div
            className="row"
            style={{
              gap: 0, marginTop: 26, paddingTop: 20,
              borderTop: '1px solid var(--line)',
            }}
          >
            <Figure value={total} label={total === 1 ? 'memory' : 'memories'} />
            {stats.people.length > 0 && (
              <Figure value={stats.people.length} label={stats.people.length === 1 ? 'person' : 'people'} />
            )}
            {stats.chapters.length > 0 && (
              <Figure value={stats.chapters.length} label="chapters" last />
            )}
          </div>
        )}
      </header>

      {/* ------------------------------------------------------- empty state */}
      {isEmpty && (
        <section
          className="card card-lg card-raised stack rise"
          style={{ background: 'var(--ink)', color: 'var(--paper)', gap: 14 }}
        >
          <h2 className="display" style={{ fontSize: 25, maxWidth: '16ch' }}>
            Start with one.
          </h2>
          <p style={{ fontSize: 15, opacity: .78, lineHeight: 1.55, maxWidth: '40ch' }}>
            Pick any memory. The first one that came to mind while you read that
            sentence. Everything else here builds itself from what you save.
          </p>
          <Link
            to="/capture"
            className="btn btn-accent"
            style={{ alignSelf: 'flex-start', marginTop: 4 }}
          >
            Add your first memory <ArrowRight size={16} weight="bold" />
          </Link>
        </section>
      )}

      {/* ------------------------------------------------------------- bento */}
      <nav
        aria-label="Main actions"
        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}
      >
        {/* The weekly action gets the full width and the accent. */}
        <Tile
          to="/capture"
          icon={Camera}
          title="Capture a moment"
          body="Photos, video and voice from today, straight onto the timeline."
          span
          tone="accent"
          i={0}
        />

        {/* The hardest-day action gets the second-largest footprint. */}
        <Tile
          to="/remind-me"
          icon={Compass}
          title="Remind me who I am"
          body="Your own evidence, read back to you."
          span
          tone="ink"
          i={1}
        />

        <Tile to="/timeline" icon={ListDashes} title="Timeline" body="Everything, in order." i={2} />
        <Tile to="/explore"  icon={BookOpen}   title="My story"  body="Seven ways to read it." i={3} />
        <Tile to="/insights" icon={ChartBar}   title="Insights"  body="The patterns underneath." span i={4} />
      </nav>

      {/* -------------------------------------------------------- the prompt */}
      {prompt && (
        <section className="reveal card card-lg stack" style={{ gap: 12 }}>
          <h2 className="display" style={{ fontSize: 22, letterSpacing: '-.028em' }}>
            {prompt.text}
          </h2>
          <p className="muted small measure">{prompt.hint}</p>
          <div className="row" style={{ gap: 8, marginTop: 4 }}>
            <Link to="/add" state={{ prompt: prompt.text }} className="btn btn-accent btn-sm">
              Answer this
            </Link>
            <Link to="/prompts" className="btn btn-ghost btn-sm">Other questions</Link>
          </div>
        </section>
      )}

      {/* ------------------------------------------------------------ privacy */}
      <div className="reveal notice">
        <Lock size={16} weight="fill" />
        <span>
          Your memories are personal. This app is designed for private reflection.
          Only share what you choose.{' '}
          <Link to="/settings" style={{ fontWeight: 600 }}>How it works</Link>
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ pieces */

function Figure({ value, label, last }: { value: number; label: string; last?: boolean }) {
  return (
    <div
      style={{
        flex: 1,
        borderRight: last ? 'none' : '1px solid var(--line)',
        paddingRight: 12,
      }}
    >
      <div className="display" style={{ fontSize: 26, lineHeight: 1 }}>{value}</div>
      <div className="tiny muted-2" style={{ marginTop: 4 }}>{label}</div>
    </div>
  );
}

function Tile({
  to, icon: Icon, title, body, span, tone, i,
}: {
  to: string;
  icon: typeof Camera;
  title: string;
  body: string;
  span?: boolean;
  tone?: 'accent' | 'ink';
  i: number;
}) {
  return (
    <Link
      to={to}
      className={`tile rise${tone === 'accent' ? ' tile-accent' : tone === 'ink' ? ' tile-ink' : ''}`}
      style={{
        '--i': i,
        gridColumn: span ? '1 / -1' : 'auto',
        flexDirection: span ? 'row' : 'column',
        alignItems: span ? 'center' : 'flex-start',
        gap: span ? 14 : 10,
        padding: span ? 20 : '18px 16px',
        minHeight: span ? 0 : 136,
      } as React.CSSProperties}
    >
      <Icon size={span ? 26 : 22} weight="regular" style={{ flexShrink: 0, opacity: tone ? 1 : .5 }} />
      <span className={span ? 'grow' : ''} style={{ display: 'block' }}>
        <span className="tile-title" style={{ fontSize: span ? 18 : 16 }}>{title}</span>
        <span className="tile-body">{body}</span>
      </span>
      {span && <ArrowRight size={17} weight="bold" style={{ opacity: .55, flexShrink: 0 }} />}
    </Link>
  );
}
