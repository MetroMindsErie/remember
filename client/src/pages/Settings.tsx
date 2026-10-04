import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import type { Insights } from '../lib/types';
import { ErrorNote, Icons, Toast } from '../lib/ui';

export default function Settings() {
  const nav = useNavigate();
  const [birthYear, setBirthYear] = useState('');
  const [saved, setSaved] = useState<number | null>(null);
  const [info, setInfo] = useState<Insights | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [theme, setTheme] = useState<'system' | 'light' | 'dark'>(
    () => (localStorage.getItem('remember.theme') as 'system' | 'light' | 'dark') || 'system'
  );

  useEffect(() => {
    api.settings().then((s) => {
      setSaved(s.birthYear);
      setBirthYear(s.birthYear ? String(s.birthYear) : '');
    }).catch(() => {});
    api.insights().then(setInfo).catch(() => {});
  }, []);

  // Theme is a per-device convenience, so localStorage is the right home for it.
  useEffect(() => {
    try { localStorage.setItem('remember.theme', theme); } catch { /* private mode */ }
    const root = document.documentElement;
    if (theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const value = birthYear.trim() === '' ? null : Number(birthYear.trim());
      const r = await api.saveSettings(value);
      setSaved(r.birthYear);
      setToast(
        r.birthYear
          ? `Saved, re-dated ${r.redated} ${r.redated === 1 ? 'memory' : 'memories'}`
          : 'Birth year cleared'
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack-l fade">
      <div className="page-head stack-s" style={{ paddingBottom: 8 }}>
        <button className="back-link" onClick={() => nav(-1)}>
          <span style={{ width: 15, height: 15, display: 'block' }}><Icons.back /></span> Back
        </button>
        <h1 className="display">Settings & privacy</h1>
      </div>

      {error && <ErrorNote error={error} />}

      {/* ------------------------------------------------------ birth year */}
      <section className="card card-lg stack">
        <h2 className="display" style={{ fontSize: 17 }}>Your birth year</h2>
        <p className="small muted">
          Optional, and it only does one thing: it lets Remember place memories you dated
          loosely, “high school”, “age 16”, “childhood”. In the right order next to the
          ones you dated by year. Without it those memories still save fine, they just sit
          in their own life-stage sections.
        </p>
        <div className="row" style={{ gap: 8 }}>
          <input
            className="input grow"
            value={birthYear}
            onChange={(e) => setBirthYear(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
            placeholder="1992"
            inputMode="numeric"
            aria-label="Birth year"
          />
          <button className="btn btn-primary" onClick={save} disabled={busy}>
            {busy ? <span className="spinner" /> : 'Save'}
          </button>
        </div>
        {saved && (
          <p className="tiny muted-2">
            Currently set to {saved}. Changing it re-dates every memory automatically.
          </p>
        )}
      </section>

      {/* ----------------------------------------------------------- theme */}
      <section className="card card-lg stack">
        <h2 className="display" style={{ fontSize: 17 }}>Appearance</h2>
        <div className="row-wrap">
          {(['system', 'light', 'dark'] as const).map((t) => (
            <button key={t} className="chip" aria-pressed={theme === t} onClick={() => setTheme(t)}>
              {t === 'system' ? 'Match my device' : t === 'light' ? 'Light' : 'Dark'}
            </button>
          ))}
        </div>
      </section>

      {/* --------------------------------------------------------- privacy */}
      <section className="card card-lg stack">
        <div className="row" style={{ gap: 8 }}>
          <span style={{ width: 17, height: 17, color: 'var(--accent)' }}><Icons.lock /></span>
          <h2 className="display" style={{ fontSize: 17 }}>Where your memories live</h2>
        </div>
        <p className="small muted" style={{ lineHeight: 1.65 }}>
          Your memories are personal. This app is designed for private reflection.
          Only share what you choose.
        </p>
        <ul className="small muted" style={{ lineHeight: 1.7, paddingLeft: 20, margin: 0 }}>
          <li>Everything you write is stored in a SQLite file on this server, and photos you upload sit next to it on disk.</li>
          <li>There are no accounts, no analytics, no tracking and no third parties.</li>
          <li>
            The AI that reads your memories is an <strong>open-weight model running on this
            same server</strong>. Your memory text is turned into vectors in this process. It is not sent to any API.
          </li>
          <li>Nothing is public. Remember has no sharing or social features at all.</li>
        </ul>
      </section>

      {/* -------------------------------------------------------------- AI */}
      {info && (
        <section className="card card-lg stack">
          <div className="row" style={{ gap: 8 }}>
            <span style={{ width: 17, height: 17, color: 'var(--ink-3)' }}><Icons.cpu /></span>
            <h2 className="display" style={{ fontSize: 17 }}>The AI, in plain terms</h2>
          </div>
          <div className="stack-s small muted" style={{ lineHeight: 1.65 }}>
            <p>
              <strong>Understanding your memories:</strong> {info.ai.embedding.model}, an
              Apache-2.0 sentence-transformer. It converts each memory into a 384-number
              vector so Remember can search by meaning and notice what your memories have
              in common. Status: {info.ai.embedding.state}, {info.ai.vectors} indexed.
            </p>
            <p>
              <strong>Writing the reflections:</strong>{' '}
              {info.ai.llm.configured ? (
                <>
                  {info.ai.llm.model} via {info.ai.llm.endpoint}
                  {info.ai.llm.local ? ', running on your own machine' : ''}. It only ever
                  rewrites text the app already composed from your memories.
                </>
              ) : (
                <>
                  no language model is configured, so reflections come from the built-in
                  composer. Everything works without one. A model is purely optional polish.
                </>
              )}
            </p>
          </div>
        </section>
      )}

      {/* ------------------------------------------------------------ urge */}
      <section className="card card-flat stack-s">
        <h2 className="display" style={{ fontSize: 15 }}>Coming later</h2>
        <p className="tiny muted" style={{ lineHeight: 1.65 }}>
          Remember is built to be opened from the Urge app as a coping tool called
          <strong> “Reconnect With Yourself.”</strong> That integration is not wired up
          yet, the two apps are deliberately separate for now.
        </p>
      </section>

      {toast && <Toast message={toast} />}
    </div>
  );
}
