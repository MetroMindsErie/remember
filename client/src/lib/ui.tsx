import type { ReactNode } from 'react';
import {
  House, Plus, ListDashes, Sparkle, ChartBar, BookOpen, UsersThree, MapPin,
  ShieldCheck, Compass, Fingerprint, MagnifyingGlass, MusicNote, VideoCamera, LinkSimple,
  Trash, CaretLeft, Check, Shuffle, Lock, Cpu, Camera, Sun, Mountains, Leaf,
  Lightning, Heart, HandsPraying, CloudRain, Wind, Waves, Flame, Plant,
  Barbell, Spiral, Radio, Anchor, User, HouseLine, Handshake, Balloon, Pencil,
  Toolbox, Island, Gift, Medal, LightbulbFilament, Sliders, Warning,
  CaretRight, ArrowsDownUp, X, Image as ImageIcon,
} from '@phosphor-icons/react';

/* ---------------------------------------------------------------- feelings

   Each feeling maps to one of the five harmonised data hues plus a Phosphor
   glyph. The hues sit in the same lightness band and are all desaturated, so
   none of them competes with the single rose accent. This is semantic
   encoding, not decoration: the colour tells you the emotional register of a
   memory before you read a word of it.                                      */

type Feel = { bg: string; fg: string; Icon: typeof Sun };

export const FEELING_STYLE: Record<string, Feel> = {
  Happy:     { bg: 'var(--d-gold-s)', fg: 'var(--d-gold)', Icon: Sun },
  Proud:     { bg: 'var(--d-clay-s)', fg: 'var(--d-clay)', Icon: Mountains },
  Peaceful:  { bg: 'var(--d-moss-s)', fg: 'var(--d-moss)', Icon: Leaf },
  Motivated: { bg: 'var(--d-clay-s)', fg: 'var(--d-clay)', Icon: Lightning },
  Loved:     { bg: 'var(--accent-soft)', fg: 'var(--accent)', Icon: Heart },
  Grateful:  { bg: 'var(--d-gold-s)', fg: 'var(--d-gold)', Icon: HandsPraying },
  Sad:       { bg: 'var(--d-iris-s)', fg: 'var(--d-iris)', Icon: CloudRain },
  Regretful: { bg: 'var(--d-iris-s)', fg: 'var(--d-iris)', Icon: Wind },
  Anxious:   { bg: 'var(--d-sea-s)',  fg: 'var(--d-sea)',  Icon: Waves },
  Angry:     { bg: 'var(--d-clay-s)', fg: 'var(--d-clay)', Icon: Flame },
  Hopeful:   { bg: 'var(--d-moss-s)', fg: 'var(--d-moss)', Icon: Plant },
  Strong:    { bg: 'var(--d-clay-s)', fg: 'var(--d-clay)', Icon: Barbell },
  Resilient: { bg: 'var(--d-moss-s)', fg: 'var(--d-moss)', Icon: Spiral },
  Nostalgic: { bg: 'var(--d-gold-s)', fg: 'var(--d-gold)', Icon: Radio },
};

export const CATEGORY_ICON: Record<string, typeof Sun> = {
  Person: User, Family: HouseLine, Friendship: Handshake, Childhood: Balloon,
  School: Pencil, Work: Toolbox, Vacation: Island, Holiday: Gift,
  Achievement: Medal, 'Hard Moment': Anchor, 'Turning Point': Compass,
  'Lesson Learned': LightbulbFilament, Music: MusicNote, Place: MapPin,
  Other: Sparkle,
};

export function feelingStyle(feeling: string): Feel {
  return FEELING_STYLE[feeling] ?? { bg: 'var(--paper-2)', fg: 'var(--ink-2)', Icon: Sparkle };
}

export function categoryIcon(category: string) {
  return CATEGORY_ICON[category] ?? Sparkle;
}

/* ------------------------------------------------------------------ pieces */

export function Badge({ children, tone }: { children: ReactNode; tone?: 'tag' }) {
  return <span className={tone === 'tag' ? 'badge badge-tag' : 'badge'}>{children}</span>;
}

export function FeelingBadge({ feeling }: { feeling: string }) {
  const { bg, fg, Icon } = feelingStyle(feeling);
  return (
    <span className="badge" style={{ background: bg, color: fg }}>
      <Icon size={13} weight="fill" /> {feeling}
    </span>
  );
}

export function CategoryBadge({ category }: { category: string }) {
  const Icon = categoryIcon(category);
  return (
    <span className="badge">
      <Icon size={13} weight="regular" /> {category}
    </span>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="row" style={{ justifyContent: 'center', padding: '40px 0', gap: 12 }}>
      <div className="spinner" />
      <span className="muted small">{label ?? 'Thinking'}</span>
    </div>
  );
}

export function ErrorNote({ error, onRetry }: { error: string; onRetry?: () => void }) {
  return (
    <div className="notice notice-error" role="alert">
      <Warning size={16} weight="fill" />
      <span className="grow">{error}</span>
      {onRetry && <button className="btn btn-sm btn-ghost" onClick={onRetry}>Retry</button>}
    </div>
  );
}

export function Empty({
  icon: Icon = Sparkle, title, body, action,
}: { icon?: typeof Sun; title: string; body: string; action?: ReactNode }) {
  return (
    <div
      className="card card-lg stack center"
      style={{ alignItems: 'center', padding: '40px 24px', gap: 12 }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 52, height: 52, borderRadius: '50%', display: 'grid',
          placeItems: 'center', background: 'var(--paper-2)', color: 'var(--ink-3)',
        }}
      >
        <Icon size={24} weight="regular" />
      </span>
      <h3 className="display" style={{ fontSize: 20 }}>{title}</h3>
      <p className="muted small" style={{ maxWidth: '34ch' }}>{body}</p>
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
          <strong
            key={i}
            className="display"
            style={{ fontSize: '1.02em', color: 'var(--ink)', fontWeight: 600 }}
          >
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

/* ------------------------------------------------------------------- icons

   One family, one weight, for the whole app. Phosphor at `regular` 1.5-ish
   stroke, `fill` reserved for small badge glyphs where a stroke would mush at
   13px.                                                                     */

export const Icons = {
  home: House, plus: Plus, timeline: ListDashes, spark: Sparkle, chart: ChartBar,
  book: BookOpen, people: UsersThree, map: MapPin, shield: ShieldCheck,
  mirror: Fingerprint, compass: Compass, search: MagnifyingGlass, music: MusicNote,
  video: VideoCamera, link: LinkSimple, trash: Trash, back: CaretLeft,
  forward: CaretRight, check: Check, shuffle: Shuffle, lock: Lock, cpu: Cpu,
  camera: Camera, sliders: Sliders, warning: Warning, sort: ArrowsDownUp,
  close: X, image: ImageIcon,
};

export type IconName = keyof typeof Icons;
