import type { ReactNode } from 'react';

/* ---------------------------------------------------------------- feelings */

/** Each feeling gets its own colour so the timeline reads emotionally at a glance. */
export const FEELING_STYLE: Record<string, { bg: string; fg: string; emoji: string }> = {
  Happy:      { bg: 'var(--gold-soft)',   fg: 'var(--gold)',   emoji: '☀️' },
  Proud:      { bg: 'var(--accent-soft)', fg: 'var(--accent-ink)', emoji: '🏔️' },
  Peaceful:   { bg: 'var(--teal-soft)',   fg: 'var(--teal)',   emoji: '🌿' },
  Motivated:  { bg: 'var(--accent-soft)', fg: 'var(--accent-ink)', emoji: '⚡' },
  Loved:      { bg: 'var(--rose-soft)',   fg: 'var(--rose)',   emoji: '💛' },
  Grateful:   { bg: 'var(--gold-soft)',   fg: 'var(--gold)',   emoji: '🙏' },
  Sad:        { bg: 'var(--violet-soft)', fg: 'var(--violet)', emoji: '🌧️' },
  Regretful:  { bg: 'var(--violet-soft)', fg: 'var(--violet)', emoji: '🍂' },
  Anxious:    { bg: 'var(--violet-soft)', fg: 'var(--violet)', emoji: '🌊' },
  Angry:      { bg: 'var(--rose-soft)',   fg: 'var(--rose)',   emoji: '🔥' },
  Hopeful:    { bg: 'var(--teal-soft)',   fg: 'var(--teal)',   emoji: '🌱' },
  Strong:     { bg: 'var(--accent-soft)', fg: 'var(--accent-ink)', emoji: '🗿' },
  Resilient:  { bg: 'var(--accent-soft)', fg: 'var(--accent-ink)', emoji: '🌾' },
  Nostalgic:  { bg: 'var(--gold-soft)',   fg: 'var(--gold)',   emoji: '📻' },
};

export const CATEGORY_EMOJI: Record<string, string> = {
  Person: '🧍', Family: '🏡', Friendship: '🤝', Childhood: '🎈', School: '✏️',
  Work: '🧰', Vacation: '🏝️', Holiday: '🎄', Achievement: '🏅',
  'Hard Moment': '🪨', 'Turning Point': '🧭', 'Lesson Learned': '📖',
  Music: '🎵', Place: '📍', Other: '✨',
};

export function feelingStyle(feeling: string) {
  return FEELING_STYLE[feeling] ?? { bg: 'var(--paper-2)', fg: 'var(--ink-2)', emoji: '•' };
}

/* ------------------------------------------------------------------ pieces */

export function Badge({
  kind = 'tag', children, title,
}: { kind?: 'cat' | 'feel' | 'time' | 'tag'; children: ReactNode; title?: string }) {
  return <span className={`badge badge-${kind}`} title={title}>{children}</span>;
}

export function FeelingBadge({ feeling }: { feeling: string }) {
  const s = feelingStyle(feeling);
  return (
    <span className="badge" style={{ background: s.bg, color: s.fg }}>
      <span aria-hidden="true">{s.emoji}</span> {feeling}
    </span>
  );
}

export function CategoryBadge({ category }: { category: string }) {
  return (
    <span className="badge badge-cat">
      <span aria-hidden="true">{CATEGORY_EMOJI[category] ?? '✨'}</span> {category}
    </span>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="row" style={{ justifyContent: 'center', padding: '36px 0', gap: 12 }}>
      <div className="spinner" />
      <span className="muted small">{label ?? 'Thinking…'}</span>
    </div>
  );
}

export function ErrorNote({ error, onRetry }: { error: string; onRetry?: () => void }) {
  return (
    <div className="notice notice-error" role="alert">
      <span aria-hidden="true">⚠</span>
      <span className="grow">{error}</span>
      {onRetry && (
        <button className="btn btn-sm btn-ghost" onClick={onRetry}>Retry</button>
      )}
    </div>
  );
}

export function Empty({
  emoji, title, body, action,
}: { emoji: string; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="card card-lg center stack" style={{ alignItems: 'center', padding: '34px 22px' }}>
      <div style={{ fontSize: 40, lineHeight: 1 }} aria-hidden="true">{emoji}</div>
      <h3 className="serif" style={{ fontSize: 20 }}>{title}</h3>
      <p className="muted small" style={{ maxWidth: 360 }}>{body}</p>
      {action}
    </div>
  );
}

/** Renders the composer's lightweight **bold lead-in** markup. */
export function RichParagraph({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return (
    <p>
      {parts.map((part, i) =>
        part.startsWith('**') && part.endsWith('**') ? (
          <strong key={i} className="serif" style={{ fontSize: '1.04em' }}>
            {part.slice(2, -2)}
          </strong>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </p>
  );
}

export function Toast({ message }: { message: string }) {
  return <div className="toast" role="status">{message}</div>;
}

/* ------------------------------------------------------------------- icons */

const ico = (d: ReactNode) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
);

export const Icons = {
  home: () => ico(<><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /></>),
  plus: () => ico(<><path d="M12 5v14" /><path d="M5 12h14" /></>),
  timeline: () => ico(<><circle cx="6" cy="6" r="2.2" /><circle cx="6" cy="18" r="2.2" /><path d="M6 8.2v7.6" /><path d="M11 6h9" /><path d="M11 18h9" /></>),
  spark: () => ico(<><path d="M12 3v3.5" /><path d="M12 17.5V21" /><path d="M3 12h3.5" /><path d="M17.5 12H21" /><path d="M12 8.2 13.6 12 12 15.8 10.4 12Z" /></>),
  chart: () => ico(<><path d="M4 20V10" /><path d="M10 20V4" /><path d="M16 20v-7" /><path d="M22 20H2" /></>),
  book: () => ico(<><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5Z" /><path d="M20 18v3H6.5" /></>),
  people: () => ico(<><circle cx="9" cy="8" r="3.2" /><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" /><path d="M16 5.2a3.2 3.2 0 0 1 0 5.6" /><path d="M18 14.8c2 .7 3 2.5 3 5.2" /></>),
  map: () => ico(<><path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11Z" /><circle cx="12" cy="10" r="2.5" /></>),
  shield: () => ico(<><path d="M12 3 5 6v6c0 4.5 3 7.7 7 9 4-1.3 7-4.5 7-9V6Z" /><path d="m9 12 2 2 4-4" /></>),
  mirror: () => ico(<><ellipse cx="12" cy="11" rx="6" ry="8" /><path d="M12 19v2" /><path d="M9 21h6" /></>),
  compass: () => ico(<><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5Z" /></>),
  search: () => ico(<><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></>),
  music: () => ico(<><circle cx="7" cy="18" r="2.5" /><circle cx="18" cy="16" r="2.5" /><path d="M9.5 18V6l11-2v12" /></>),
  video: () => ico(<><rect x="2.5" y="6" width="13" height="12" rx="2.5" /><path d="m16 12 5.5-3.5v7Z" /></>),
  link: () => ico(<><path d="M10 13a4 4 0 0 0 5.7 0l2.8-2.8A4 4 0 0 0 12.8 4.5L11.5 5.8" /><path d="M14 11a4 4 0 0 0-5.7 0L5.5 13.8a4 4 0 0 0 5.7 5.7l1.3-1.3" /></>),
  trash: () => ico(<><path d="M4 7h16" /><path d="M9 7V4.5h6V7" /><path d="M6 7l1 13h10l1-13" /></>),
  back: () => ico(<><path d="M15 5l-7 7 7 7" /></>),
  check: () => ico(<><path d="m5 13 4.5 4.5L19 7" /></>),
  shuffle: () => ico(<><path d="M17 4h4v4" /><path d="M21 4 4 21" /><path d="M17 20h4v-4" /><path d="m14 14 7 7" /><path d="M4 4l5 5" /></>),
  lock: () => ico(<><rect x="4.5" y="10.5" width="15" height="10" rx="2.5" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" /></>),
  cpu: () => ico(<><rect x="7" y="7" width="10" height="10" rx="2" /><path d="M4 10h3M4 14h3M17 10h3M17 14h3M10 4v3M14 4v3M10 17v3M14 17v3" /></>),
};

export type IconName = keyof typeof Icons;
