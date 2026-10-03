import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import type { Prompt } from '../lib/types';
import { CATEGORY_EMOJI, ErrorNote, Icons, Spinner, feelingStyle } from '../lib/ui';

export default function Prompts() {
  const nav = useNavigate();
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [groups, setGroups] = useState<string[]>([]);
  const [group, setGroup] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hideAnswered, setHideAnswered] = useState(false);

  useEffect(() => {
    api.prompts()
      .then((r) => { setPrompts(r.prompts); setGroups(r.groups); })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  const shown = useMemo(() => {
    let list = prompts;
    if (group) list = list.filter((p) => p.group === group);
    if (hideAnswered) list = list.filter((p) => !p.answered);
    return list;
  }, [prompts, group, hideAnswered]);

  const answeredCount = prompts.filter((p) => p.answered).length;

  const answer = (p: Prompt) =>
    nav('/add', { state: { prompt: p.text, category: p.category, feeling: p.feeling } });

  const surprise = () => {
    const pool = prompts.filter((p) => !p.answered);
    const pick = (pool.length ? pool : prompts)[Math.floor(Math.random() * (pool.length || prompts.length))];
    if (pick) answer(pick);
  };

  return (
    <div className="stack-l fade-in">
      <div className="page-head stack-s" style={{ paddingBottom: 8 }}>
        <button className="back-link" onClick={() => nav(-1)}>
          <span style={{ width: 15, height: 15, display: 'block' }}><Icons.back /></span> Back
        </button>
        <h1 className="serif">Questions for you</h1>
        <p className="sub">
          Pick one and answer it as a memory. Easier than staring at a blank page —
          and you have answered {answeredCount} of {prompts.length} so far.
        </p>
      </div>

      {error && <ErrorNote error={error} />}
      {loading && <Spinner label="Loading questions…" />}

      {!loading && prompts.length > 0 && (
        <>
          <button className="btn btn-accent btn-block" onClick={surprise}>
            <span style={{ width: 17, height: 17, display: 'block' }}><Icons.shuffle /></span>
            Surprise me
          </button>

          <div className="row-wrap">
            <button className="chip" aria-pressed={group === null} onClick={() => setGroup(null)}>
              All
            </button>
            {groups.map((g) => (
              <button key={g} className="chip" aria-pressed={group === g} onClick={() => setGroup(g)}>
                {g}
              </button>
            ))}
            <button className="chip" aria-pressed={hideAnswered} onClick={() => setHideAnswered((h) => !h)}>
              {hideAnswered ? 'Showing unanswered' : 'Hide answered'}
            </button>
          </div>

          <div className="stack">
            {shown.map((p, i) => {
              const fs = feelingStyle(p.feeling);
              return (
                <article
                  key={p.id}
                  className="card card-lg stack rise"
                  style={{ animationDelay: `${Math.min(i, 8) * 40}ms`, opacity: p.answered ? .72 : 1 }}
                >
                  <div className="spread" style={{ alignItems: 'flex-start' }}>
                    <h2 className="serif grow" style={{ fontSize: 18.5 }}>{p.text}</h2>
                    {p.answered && (
                      <span className="badge" style={{ background: fs.bg, color: fs.fg }}>
                        <span style={{ width: 11, height: 11, display: 'block' }}><Icons.check /></span> Answered
                      </span>
                    )}
                  </div>
                  <p className="small muted">{p.hint}</p>
                  <div className="spread">
                    <span className="badge badge-cat">
                      <span aria-hidden="true">{CATEGORY_EMOJI[p.category] ?? '✨'}</span> {p.category}
                    </span>
                    <button className="btn btn-sm btn-ghost" onClick={() => answer(p)}>
                      {p.answered ? 'Answer again' : 'Answer this'} →
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

          {shown.length === 0 && (
            <div className="card card-lg center stack" style={{ alignItems: 'center' }}>
              <p style={{ fontSize: 32 }} aria-hidden="true">🎉</p>
              <p className="serif" style={{ fontSize: 18 }}>You have answered all of these.</p>
              <p className="small muted">That is a lot of your story written down.</p>
              <Link to="/remind-me" className="btn btn-accent">See what it says about you</Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}
