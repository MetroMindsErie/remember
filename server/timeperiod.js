/**
 * Remember lets people describe *when* something happened the way they actually
 * remember it: "high school", "age 16", "Christmas 2020", "the summer after
 * college". This turns those human phrases into a sortable number so the
 * timeline can still be ordered, without ever forcing a date picker on anyone.
 *
 * The returned value is an approximate decimal year. When we genuinely cannot
 * tell, we return null and the timeline treats the memory as undated.
 */

const MONTHS = {
  january: 1, jan: 1, february: 2, feb: 2, march: 3, mar: 3, april: 4, apr: 4,
  may: 5, june: 6, jun: 6, july: 7, jul: 7, august: 8, aug: 8,
  september: 9, sept: 9, sep: 9, october: 10, oct: 10,
  november: 11, nov: 11, december: 12, dec: 12,
};

// Seasons and holidays give us a month hint, which refines ordering within a year.
const MONTH_HINTS = {
  spring: 4, summer: 7, fall: 10, autumn: 10, winter: 1,
  christmas: 12, xmas: 12, 'new year': 1, nye: 12, hanukkah: 12,
  thanksgiving: 11, halloween: 10, easter: 4, 'fourth of july': 7,
  'july 4th': 7, 'independence day': 7, valentine: 2, birthday: 6,
};

// Life stages, expressed as an age range. Combined with a birth year (when the
// user has told us one) these become real years; otherwise they still give us a
// stable relative ordering via the LIFE_STAGE_ORDER fallback.
const LIFE_STAGES = {
  birth: [0, 0], infancy: [0, 2], baby: [0, 2], toddler: [2, 4],
  preschool: [3, 5], kindergarten: [5, 6],
  childhood: [4, 11], 'as a kid': [4, 11], 'growing up': [5, 14],
  'elementary school': [5, 11], 'grade school': [5, 11], 'primary school': [5, 11],
  'middle school': [11, 14], 'junior high': [11, 14], 'jr high': [11, 14],
  'high school': [14, 18], highschool: [14, 18], teens: [13, 19],
  teenager: [13, 19], adolescence: [13, 19],
  college: [18, 22], university: [18, 22], uni: [18, 22], undergrad: [18, 22],
  'grad school': [22, 26], 'graduate school': [22, 26],
  'first job': [18, 24], 'early twenties': [20, 24], '20s': [20, 29],
  twenties: [20, 29], 'late twenties': [25, 29],
  '30s': [30, 39], thirties: [30, 39], '40s': [40, 49], forties: [40, 49],
  '50s': [50, 59], fifties: [50, 59],
};

// Used only when we have no birth year: keeps life stages in the right order
// relative to each other on a synthetic scale far below real calendar years.
const LIFE_STAGE_SCALE = -1000;

const ORDINAL_WORDS = {
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6,
  seventh: 7, eighth: 8, ninth: 9, tenth: 10, eleventh: 11, twelfth: 12,
};

function clean(input) {
  return String(input || '').toLowerCase().trim().replace(/\s+/g, ' ');
}

function monthHint(text) {
  for (const [word, month] of Object.entries(MONTHS)) {
    if (new RegExp(`\\b${word}\\b`).test(text)) return month;
  }
  for (const [word, month] of Object.entries(MONTH_HINTS)) {
    if (text.includes(word)) return month;
  }
  return null;
}

/** Fractional offset within a year, so "Christmas 2020" sorts after "June 2020". */
function monthFraction(month) {
  return month == null ? 0.5 : (month - 0.5) / 12;
}

/**
 * @param {string} input   what the user typed, e.g. "high school"
 * @param {object} [opts]
 * @param {number} [opts.birthYear] if known, ages and life stages become real years
 * @returns {{ sort: number|null, confidence: 'exact'|'year'|'estimated'|'relative'|'unknown', label: string }}
 */
export function parseTimePeriod(input, opts = {}) {
  const text = clean(input);
  const label = String(input || '').trim();
  const birthYear = Number.isFinite(opts.birthYear) ? opts.birthYear : null;
  const now = new Date();
  const thisYear = now.getFullYear();

  if (!text) return { sort: null, confidence: 'unknown', label };

  // --- Full ISO or slashed dates: 2018-07-04, 7/4/2018 ---
  const iso = text.match(/\b(\d{4})-(\d{1,2})(?:-(\d{1,2}))?\b/);
  if (iso) {
    const [, y, m, d] = iso;
    const frac = (Number(m) - 1 + (Number(d || 15) - 1) / 31) / 12;
    return { sort: Number(y) + frac, confidence: 'exact', label };
  }
  const slashed = text.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/);
  if (slashed) {
    const [, m, d, yRaw] = slashed;
    const y = yRaw.length === 2 ? (Number(yRaw) > 40 ? 1900 : 2000) + Number(yRaw) : Number(yRaw);
    const frac = (Number(m) - 1 + (Number(d) - 1) / 31) / 12;
    return { sort: y + frac, confidence: 'exact', label };
  }

  // --- Explicit age: "age 16", "when I was 16", "16 years old" ---
  const age =
    text.match(/\bage[ds]?\s*(\d{1,2})\b/) ||
    text.match(/\bwhen i was (\d{1,2})\b/) ||
    text.match(/\b(\d{1,2})\s*(?:years? old|yo|yrs old)\b/) ||
    text.match(/\bat (\d{1,2})\b/);
  if (age) {
    const a = Number(age[1]);
    if (a <= 110) {
      if (birthYear) return { sort: birthYear + a + 0.5, confidence: 'estimated', label };
      return { sort: LIFE_STAGE_SCALE + a, confidence: 'relative', label };
    }
  }

  // --- Decades: "the 90s", "1980s", "early 2000s" ---
  const decade = text.match(/\b(?:19|20)?(\d0)'?s\b/);
  if (decade && !/\b(?:19|20)\d{2}\b/.test(text)) {
    const raw = text.match(/\b((?:19|20)\d0)'?s\b/);
    let start = raw ? Number(raw[1]) : Number(decade[1]) + (Number(decade[1]) >= 30 ? 1900 : 2000);
    // Guard against reading "20s"/"30s" as a decade when it means an age range.
    if (!LIFE_STAGES[decade[1] + 's'] || raw) {
      let offset = 5;
      if (/\bearly\b/.test(text)) offset = 2;
      if (/\bmid(?:dle)?\b/.test(text)) offset = 5;
      if (/\blate\b/.test(text)) offset = 8;
      return { sort: start + offset, confidence: 'estimated', label };
    }
  }

  // --- Relative: "last year", "3 years ago", "this summer", "yesterday" ---
  if (/\b(today|yesterday|this week|last week|this month|last month|recently|lately|right now|these days)\b/.test(text)) {
    const frac = monthFraction(now.getMonth() + 1);
    return { sort: thisYear + frac, confidence: 'estimated', label };
  }
  if (/\blast year\b/.test(text)) return { sort: thisYear - 1 + 0.5, confidence: 'estimated', label };
  const ago = text.match(/\b(\d{1,3}|a few|couple(?: of)?|several)\s*(year|month|decade)s?\s*ago\b/);
  if (ago) {
    const qtyRaw = ago[1];
    const qty = /^\d+$/.test(qtyRaw) ? Number(qtyRaw) : qtyRaw === 'several' ? 5 : 3;
    const unit = ago[2];
    const years = unit === 'decade' ? qty * 10 : unit === 'month' ? qty / 12 : qty;
    return { sort: thisYear + monthFraction(now.getMonth() + 1) - years, confidence: 'estimated', label };
  }

  // --- A bare or embedded 4-digit year, optionally with a month/season ---
  const years = [...text.matchAll(/\b((?:1[89]|20)\d{2})\b/g)].map((m) => Number(m[1]));
  if (years.length) {
    const plausible = years.filter((y) => y >= 1900 && y <= thisYear + 1);
    if (plausible.length) {
      // A range like "2012-2015" sorts at its midpoint.
      const lo = Math.min(...plausible);
      const hi = Math.max(...plausible);
      if (hi !== lo) return { sort: (lo + hi) / 2, confidence: 'estimated', label };
      return {
        sort: lo + monthFraction(monthHint(text)),
        confidence: monthHint(text) ? 'estimated' : 'year',
        label,
      };
    }
  }

  // --- Named grade: "10th grade", "senior year", "freshman year" ---
  const gradeNum = text.match(/\b(\d{1,2})(?:st|nd|rd|th)? grade\b/);
  const gradeWord = Object.keys(ORDINAL_WORDS).find((w) => text.includes(`${w} grade`));
  const schoolYear = { freshman: 14, sophomore: 15, junior: 16, senior: 17 };
  const yearWord = Object.keys(schoolYear).find((w) => text.includes(w));
  let impliedAge = null;
  if (gradeNum) impliedAge = Number(gradeNum[1]) + 5;
  else if (gradeWord) impliedAge = ORDINAL_WORDS[gradeWord] + 5;
  else if (yearWord) impliedAge = schoolYear[yearWord] + (text.includes('college') ? 4 : 0);
  if (impliedAge != null && impliedAge <= 30) {
    if (birthYear) return { sort: birthYear + impliedAge + 0.5, confidence: 'estimated', label };
    return { sort: LIFE_STAGE_SCALE + impliedAge, confidence: 'relative', label };
  }

  // --- Life stages: "high school", "childhood", "my twenties" ---
  const stageKey = Object.keys(LIFE_STAGES)
    .filter((k) => text.includes(k))
    .sort((a, b) => b.length - a.length)[0];
  if (stageKey) {
    const [lo, hi] = LIFE_STAGES[stageKey];
    let mid = (lo + hi) / 2;
    if (/\bearly\b/.test(text)) mid = lo + (hi - lo) * 0.2;
    if (/\blate\b/.test(text)) mid = lo + (hi - lo) * 0.8;
    if (birthYear) return { sort: birthYear + mid + 0.5, confidence: 'estimated', label };
    return { sort: LIFE_STAGE_SCALE + mid, confidence: 'relative', label };
  }

  // --- A month with no year at all: assume the most recent occurrence ---
  const m = monthHint(text);
  if (m != null) {
    const assumedYear = m > now.getMonth() + 1 ? thisYear - 1 : thisYear;
    return { sort: assumedYear + monthFraction(m), confidence: 'estimated', label };
  }

  return { sort: null, confidence: 'unknown', label };
}

/**
 * Buckets memories into readable chapters ("Childhood", "2018", "Recently")
 * for the timeline and the Insights "most active time periods" stat.
 */
export function chapterFor(sort, label) {
  if (sort == null) return 'Sometime';
  if (sort < 0) {
    const age = sort - LIFE_STAGE_SCALE;
    if (age < 5) return 'Earliest years';
    if (age < 12) return 'Childhood';
    if (age < 19) return 'Teenage years';
    if (age < 23) return 'Early adulthood';
    return 'Adulthood';
  }
  const year = Math.floor(sort);
  const thisYear = new Date().getFullYear();
  if (year >= thisYear - 1) return 'Recently';
  return String(year);
}

export { LIFE_STAGE_SCALE };
