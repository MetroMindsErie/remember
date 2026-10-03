import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Icons } from '../lib/ui';

const ACTIONS = [
  { to: '/add',       title: 'Add Memory',          sub: 'Capture something before it fades.',      icon: Icons.plus,     grad: 'var(--grad-warm)' },
  { to: '/timeline',  title: 'My Timeline',         sub: 'Everything you have saved, in order.',    icon: Icons.timeline, grad: 'var(--grad-calm)' },
  { to: '/remind-me', title: 'Remind Me Who I Am',  sub: 'When you need your own evidence.',        icon: Icons.spark,    grad: 'var(--grad-dusk)' },
  { to: '/explore',   title: 'Explore My Story',    sub: 'Your life, read back to you.',            icon: Icons.book,     grad: 'var(--grad-warm)' },
  { to: '/insights',  title: 'Insights',            sub: 'The patterns across your memories.',      icon: Icons.chart,    grad: 'var(--grad-calm)' },
];

export default function Home() {
  const [count, setCount] = useState<number | null>(null);
  const [prompt, setPrompt] = useState<{ text: string; hint: string } | null>(null);

  useEffect(() => {
    api.listMemories().then((r) => setCount(r.count)).catch(() => setCount(null));
    api.prompts()
      .then(({ prompts }) => {
        const open = prompts.filter((p) => !p.answered);
        const pool = open.length ? open : prompts;
        const pick = pool[Math.floor(Math.random() * pool.length)];
        if (pick) setPrompt({ text: pick.text, hint: pick.hint });
      })
      .catch(() => {});
  }, []);

  return (
    <div className="stack-l fade-in" style={{ paddingTop: 30 }}>
      <header className="stack-s">
        <h1 className="serif" style={{ fontSize: 42, lineHeight: 1.05 }}>Remember</h1>
        <p style={{ fontSize: 17.5, color: 'var(--ink-2)' }}>Reconnect with who you are.</p>
        {count !== null && count > 0 && (
          <p className="small muted-2" style={{ marginTop: 2 }}>
            {count} {count === 1 ? 'memory' : 'memories'} saved — and they are all still yours.
          </p>
        )}
      </header>

      {count === 0 && (
        <div
          className="card card-lg stack"
          style={{ background: 'var(--grad-warm)', border: 0, color: '#3a2415' }}
        >
          <h2 className="serif" style={{ fontSize: 22 }}>Start with one.</h2>
          <p style={{ fontSize: 15, opacity: .88 }}>
            You do not have to be organised about this. Pick any memory — the first
            one that came to mind while you read that sentence — and write it down.
            Everything else in Remember builds itself from what you save.
          </p>
          <Link to="/add" className="btn btn-primary btn-block" style={{ marginTop: 4 }}>
            Add your first memory
          </Link>
        </div>
      )}

      <div className="stack">
        {ACTIONS.map(({ to, title, sub, icon: Icon, grad }, i) => (
          <Link
            key={to}
            to={to}
            className="card card-lg rise"
            style={{
              display: 'flex', alignItems: 'center', gap: 15,
              color: 'inherit', textDecoration: 'none',
              animationDelay: `${i * 55}ms`,
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 46, height: 46, flexShrink: 0, borderRadius: 15,
                background: grad, display: 'grid', placeItems: 'center',
                color: '#4a2d18',
              }}
            >
              <span style={{ width: 22, height: 22, display: 'block' }}><Icon /></span>
            </span>
            <span className="grow stack-s" style={{ gap: 2 }}>
              <span className="serif" style={{ fontSize: 17.5 }}>{title}</span>
              <span className="small muted">{sub}</span>
            </span>
            <span className="muted-2" aria-hidden="true">›</span>
          </Link>
        ))}
      </div>

      {prompt && (
        <div className="card card-lg stack" style={{ background: 'var(--paper-2)' }}>
          <span className="tiny" style={{ color: 'var(--accent)', fontWeight: 700, letterSpacing: '.06em' }}>
            A QUESTION FOR YOU
          </span>
          <h2 className="serif" style={{ fontSize: 20.5 }}>{prompt.text}</h2>
          <p className="small muted">{prompt.hint}</p>
          <div className="row" style={{ gap: 8, marginTop: 2 }}>
            <Link
              to="/add"
              state={{ prompt: prompt.text }}
              className="btn btn-accent grow"
              style={{ justifyContent: 'center' }}
            >
              Answer this
            </Link>
            <Link to="/prompts" className="btn btn-ghost">More questions</Link>
          </div>
        </div>
      )}

      <div className="notice">
        <span style={{ width: 16, height: 16, flexShrink: 0, marginTop: 2 }}><Icons.lock /></span>
        <span>
          Your memories are personal. This app is designed for private reflection.
          Only share what you choose.{' '}
          <Link to="/settings" style={{ fontWeight: 600 }}>How it works →</Link>
        </span>
      </div>
    </div>
  );
}
