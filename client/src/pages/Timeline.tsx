import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api, type TimelineQuery } from '../lib/api';
import type { Facets, Memory } from '../lib/types';
import { CATEGORY_EMOJI, Empty, ErrorNote, Icons, Spinner, Toast, feelingStyle } from '../lib/ui';
import { MemoryCard } from '../components/MemoryCard';

type FilterKey = 'category' | 'feeling' | 'person' | 'tag' | 'place';

const FILTER_LABEL: Record<FilterKey, string> = {
  category: 'Category', feeling: 'Feeling', person: 'Person', tag: 'Tag', place: 'Place',
};

export default function Timeline() {
  const location = useLocation() as { state?: { highlight?: string; saved?: boolean } };

  const [memories, setMemories] = useState<Memory[]>([]);
  const [facets, setFacets] = useState<Facets | null>(null);
  const [query, setQuery] = useState<TimelineQuery>({ sort: 'newest' });
  const [searchBox, setSearchBox] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [openFilter, setOpenFilter] = useState<FilterKey | null>(null);
  const [toast, setToast] = useState<string | null>(location.state?.saved ? 'Memory saved' : null);

  const load = useCallback(async (q: TimelineQuery) => {
    setLoading(true);
    setError(null);
    try {
      const r = await api.listMemories(q);
      setMemories(r.memories);
      setSearched(r.searched);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(query); }, [query, load]);
  useEffect(() => { api.facets().then(setFacets).catch(() => {}); }, []);

  // Toasts should disappear on their own.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  // Debounce the search box so we are not embedding a query on every keystroke.
  const debounce = useRef<number | undefined>(undefined);
  useEffect(() => {
    window.clearTimeout(debounce.current);
    debounce.current = window.setTimeout(() => {
      setQuery((q) => (q.q === (searchBox || undefined) ? q : { ...q, q: searchBox || undefined }));
    }, 320);
    return () => window.clearTimeout(debounce.current);
  }, [searchBox]);

  const setFilter = (key: FilterKey, value: string | undefined) => {
    setQuery((q) => ({ ...q, [key]: q[key] === value ? undefined : value }));
    setOpenFilter(null);
  };

  const active = (['category', 'feeling', 'person', 'tag', 'place'] as FilterKey[])
    .filter((k) => query[k]);

  const clearAll = () => { setQuery({ sort: query.sort }); setSearchBox(''); };

  async function remove(id: string) {
    const previous = memories;
    setMemories((m) => m.filter((x) => x.id !== id)); // optimistic
    try {
      await api.deleteMemory(id);
      setToast('Memory deleted');
      api.facets().then(setFacets).catch(() => {});
    } catch (e) {
      setMemories(previous);
      setError((e as Error).message);
    }
  }

  const options = (key: FilterKey): string[] => {
    if (!facets) return [];
    if (key === 'category') return facets.usedCategories;
    if (key === 'feeling') return facets.usedFeelings;
    if (key === 'person') return facets.people;
    if (key === 'tag') return facets.tags;
    return facets.places;
  };

  // Group by chapter so the timeline reads like a life, not a list.
  const groups: { chapter: string; items: Memory[] }[] = [];
  for (const m of memories) {
    const label = searched ? 'Most relevant' : (m.chapter || 'Sometime');
    const last = groups[groups.length - 1];
    if (last && last.chapter === label) last.items.push(m);
    else groups.push({ chapter: label, items: [m] });
  }

  return (
    <div className="stack-l fade-in">
      <div className="page-head">
        <h1 className="serif">My Timeline</h1>
        <p className="sub">
          {loading ? 'Loading…'
            : memories.length === 0 ? 'Nothing here yet.'
            : `${memories.length} ${memories.length === 1 ? 'memory' : 'memories'}${searched ? ', by relevance' : ''}`}
        </p>
      </div>

      {/* search */}
      <div style={{ position: 'relative' }}>
        <span
          aria-hidden="true"
          style={{
            position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
            width: 17, height: 17, color: 'var(--ink-3)',
          }}
        >
          <Icons.search />
        </span>
        <input
          className="input"
          style={{ paddingLeft: 42, paddingRight: searchBox ? 42 : 14 }}
          value={searchBox}
          onChange={(e) => setSearchBox(e.target.value)}
          placeholder="Search your memories…"
          aria-label="Search your memories"
          type="search"
        />
        {searchBox && (
          <button
            className="btn-plain muted-2"
            onClick={() => setSearchBox('')}
            aria-label="Clear search"
            style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)' }}
          >
            ✕
          </button>
        )}
      </div>
      {searchBox && (
        <p className="tiny muted-2" style={{ marginTop: -8 }}>
          Searching by meaning, not just words — try “what did I survive” or “people who took care of me”.
        </p>
      )}

      {/* filters */}
      <div className="stack-s">
        <div className="row-wrap">
          {(['category', 'feeling', 'person', 'tag', 'place'] as FilterKey[]).map((key) => {
            const count = options(key).length;
            if (!count) return null;
            return (
              <button
                key={key}
                className="chip"
                aria-pressed={Boolean(query[key])}
                aria-expanded={openFilter === key}
                onClick={() => setOpenFilter((o) => (o === key ? null : key))}
              >
                {query[key] ?? FILTER_LABEL[key]}
                <span className="muted-2 tiny" aria-hidden="true">{openFilter === key ? '▴' : '▾'}</span>
              </button>
            );
          })}
          <button
            className="chip"
            onClick={() => setQuery((q) => ({ ...q, sort: q.sort === 'newest' ? 'oldest' : 'newest' }))}
            title="Change the order"
          >
            {query.sort === 'oldest' ? '↑ Oldest first' : '↓ Newest first'}
          </button>
          {(active.length > 0 || searchBox) && (
            <button className="chip" onClick={clearAll}>Clear all ✕</button>
          )}
        </div>

        {openFilter && (
          <div className="card card-flat stack-s fade-in">
            <span className="tiny muted-2" style={{ fontWeight: 700, letterSpacing: '.05em' }}>
              {FILTER_LABEL[openFilter].toUpperCase()}
            </span>
            <div className="row-wrap">
              {options(openFilter).map((opt) => (
                <button
                  key={opt} className="chip"
                  aria-pressed={query[openFilter] === opt}
                  onClick={() => setFilter(openFilter, opt)}
                >
                  {openFilter === 'category' && <span aria-hidden="true">{CATEGORY_EMOJI[opt] ?? '✨'}</span>}
                  {openFilter === 'feeling' && <span aria-hidden="true">{feelingStyle(opt).emoji}</span>}
                  {openFilter === 'tag' ? `#${opt}` : opt}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {error && <ErrorNote error={error} onRetry={() => load(query)} />}

      {loading && memories.length === 0 && <Spinner label="Reading your timeline…" />}

      {!loading && memories.length === 0 && !error && (
        active.length > 0 || searchBox ? (
          <Empty
            emoji="🔍"
            title="Nothing matches that"
            body="Try a different word, or clear the filters to see everything again."
            action={<button className="btn btn-ghost" onClick={clearAll}>Clear filters</button>}
          />
        ) : (
          <Empty
            emoji="🕊️"
            title="Your timeline is waiting"
            body="Save one memory and it will show up here. Remember builds your story, your insights and your reflections from whatever you put in."
            action={<Link to="/add" className="btn btn-accent">Add a memory</Link>}
          />
        )
      )}

      {/* the timeline itself */}
      <div className="stack-l">
        {groups.map((group) => (
          <section key={group.chapter} className="stack">
            <div className="row" style={{ gap: 10 }}>
              <h2 className="serif" style={{ fontSize: 15, letterSpacing: '.02em', color: 'var(--ink-2)' }}>
                {group.chapter}
              </h2>
              <hr className="divider grow" />
              <span className="tiny muted-2">{group.items.length}</span>
            </div>
            <div className="stack">
              {group.items.map((m) => (
                <div
                  key={m.id}
                  style={
                    location.state?.highlight === m.id
                      ? { outline: '2.5px solid var(--accent)', borderRadius: 'var(--radius-lg)' }
                      : undefined
                  }
                >
                  <MemoryCard
                    memory={m}
                    onDelete={remove}
                    onFilter={(key, value) => setFilter(key, value)}
                    defaultOpen={location.state?.highlight === m.id}
                  />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      {toast && <Toast message={toast} />}
    </div>
  );
}
