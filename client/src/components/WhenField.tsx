import { useEffect, useRef, useState } from 'react';
import { CalendarBlank, ChatText, Sparkle } from '@phosphor-icons/react';

/**
 * The "when did this happen" control.
 *
 * Two modes, because the two cases are genuinely different. A photo from a
 * specific afternoon has an exact date and deserves a calendar. A memory of
 * "my grandmother's kitchen" does not have one, and forcing a date picker on
 * it makes the app unusable for exactly the memories it exists to hold.
 *
 * Exact mode uses a native date input on purpose: on a phone that is the real
 * system calendar, which beats any JavaScript date picker on accessibility,
 * familiarity and bundle size.
 */

export const QUICK_WHEN = ['today', 'yesterday', 'this weekend', 'last week', 'last month'];
export const ROUGH_EXAMPLES = ['childhood', 'high school', '2018', 'age 16', 'Christmas 2020'];

export function todayISO() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function WhenField({
  happenedOn, timePeriod, onChange, suggestion, quick = ROUGH_EXAMPLES,
}: {
  happenedOn: string;
  timePeriod: string;
  onChange: (next: { happenedOn: string; timePeriod: string }) => void;
  /** A date read out of an uploaded photo, offered rather than forced. */
  suggestion?: { date: string; from: string; plural?: boolean; range?: [string, string] } | null;
  quick?: string[];
}) {
  const [mode, setMode] = useState<'exact' | 'rough'>(happenedOn ? 'exact' : 'rough');

  /**
   * Has the person actually chosen a date, as opposed to the field just
   * sitting on its default? This is the difference between "the day this
   * happened" and "the day they happened to upload it", and the whole point
   * of the field is that those are not the same date.
   */
  const userPicked = useRef(false);
  const [autoApplied, setAutoApplied] = useState<string | null>(null);

  /**
   * When the photos know when they were taken and the person has not said
   * otherwise, use the photo date. Offering it as a tap meant a batch of old
   * photos quietly saved under today's date whenever the prompt went unnoticed,
   * which is exactly the bug this field exists to prevent.
   */
  useEffect(() => {
    if (!suggestion?.date || userPicked.current) return;
    if (suggestion.date === happenedOn) return;
    setMode('exact');
    setAutoApplied(suggestion.date);
    onChange({ happenedOn: suggestion.date, timePeriod });
    // onChange is recreated each render by the callers, so it is deliberately
    // not a dependency: including it would re-fire this on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestion?.date]);

  const setExact = (date: string) => {
    userPicked.current = true;
    setAutoApplied(null);
    onChange({ happenedOn: date, timePeriod });
  };
  const setRough = (text: string) => {
    userPicked.current = true;
    setAutoApplied(null);
    onChange({ happenedOn: '', timePeriod: text });
  };

  return (
    <div className="field">
      <label htmlFor={mode === 'exact' ? 'when-date' : 'when-text'}>When did this happen?</label>

      <div className="row" style={{ gap: 6 }} role="group" aria-label="How to enter the date">
        <button
          type="button" className="chip" aria-pressed={mode === 'exact'}
          onClick={() => { setMode('exact'); if (!happenedOn) setExact(todayISO()); }}
        >
          <CalendarBlank size={14} /> Exact date
        </button>
        <button
          type="button" className="chip" aria-pressed={mode === 'rough'}
          onClick={() => { setMode('rough'); if (happenedOn) setRough(timePeriod); }}
        >
          <ChatText size={14} /> In my own words
        </button>
      </div>

      {mode === 'exact' ? (
        <>
          <input
            id="when-date"
            className="input"
            type="date"
            value={happenedOn}
            max={todayISO()}
            onChange={(e) => setExact(e.target.value)}
          />
          <span className="help">
            The day it happened, which does not have to be the day you add it here.
            Memories with a real date sort exactly, whenever you got round to saving them.
          </span>

          {autoApplied && autoApplied === happenedOn && (
            <div className="notice">
              <Sparkle size={16} weight="fill" />
              <span className="grow">
                Dated <strong>{formatHuman(autoApplied)}</strong>, from when your{' '}
                {suggestion?.plural ? 'photos were' : 'photo was'} taken. Change it above
                if that is not right.
              </span>
            </div>
          )}

          {suggestion?.date && suggestion.date !== happenedOn && (
            <button
              type="button"
              className="notice"
              onClick={() => setExact(suggestion.date)}
              style={{ textAlign: 'left', cursor: 'pointer', width: '100%', border: 0 }}
            >
              <Sparkle size={16} weight="fill" />
              <span className="grow">
                Your {suggestion.from} {suggestion.plural ? 'say' : 'says'}{' '}
                <strong>{formatHuman(suggestion.date)}</strong>. Tap to use it.
              </span>
            </button>
          )}
        </>
      ) : (
        <>
          <input
            id="when-text"
            className="input"
            value={timePeriod}
            onChange={(e) => setRough(e.target.value)}
            placeholder="high school"
          />
          <span className="help">
            However you remember it. "High school", "2018", "age 16" and "Christmas
            2020" all work.
          </span>
          <div className="row-wrap" style={{ marginTop: 2 }}>
            {quick.map((t) => (
              <button
                key={t} type="button" className="chip"
                aria-pressed={timePeriod === t}
                onClick={() => setRough(t)}
              >
                {t}
              </button>
            ))}
          </div>
        </>
      )}

      {suggestion?.range && (
        <span className="help">
          These files were taken between <strong>{formatHuman(suggestion.range[0])}</strong>{' '}
          and <strong>{formatHuman(suggestion.range[1])}</strong>. They are saving as one
          memory, so pick the date that belongs to it, or save them as separate memories.
        </span>
      )}
    </div>
  );
}

function formatHuman(iso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const MONTHS = ['January','February','March','April','May','June','July',
    'August','September','October','November','December'];
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}
