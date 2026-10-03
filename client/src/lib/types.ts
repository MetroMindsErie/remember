export type Memory = {
  id: string;
  created_at: string;
  updated_at: string;
  title: string;
  memory_text: string;
  people: string[];
  place: string;
  time_period: string;
  time_sort: number | null;
  chapter: string;
  category: string;
  feeling: string;
  meaning: string;
  photo_url: string;
  video_url: string;
  music_url: string;
  attachment_url: string;
  tags: string[];
  prompt: string;
  _search?: { score: number; matchedOn: 'both' | 'name' | 'meaning' | 'all' };
};

export type MemoryDraft = Omit<
  Memory,
  'id' | 'created_at' | 'updated_at' | 'time_sort' | 'chapter' | '_search'
>;

export type Facets = {
  categories: string[];
  feelings: string[];
  usedCategories: string[];
  usedFeelings: string[];
  people: string[];
  places: string[];
  tags: string[];
};

export type Tally = { label: string; count: number };
export type ValueTheme = { id: string; label: string; strength: number; memories: number };

export type Reminder = {
  headline: string;
  paragraphs: string[];
  statements: string[];
  evidence: {
    people: Tally[];
    places: Tally[];
    values: ValueTheme[];
    proof: { id: string; title: string; category: string; feeling: string; time_period: string }[];
  };
  empty: boolean;
  polishedBy?: string;
};

export type Story = {
  title: string;
  paragraphs: string[];
  highlights: { id: string; title: string; category: string; feeling: string; time_period: string }[];
  empty: boolean;
  polishedBy?: string;
};

export type Lens = { id: string; label: string; blurb: string; icon: string };

export type Insights = {
  total: number;
  topFeeling: Tally | null;
  topCategory: Tally | null;
  feelings: Tally[];
  categories: Tally[];
  people: Tally[];
  places: Tally[];
  tags: Tally[];
  chapters: Tally[];
  media: { photos: number; music: number; video: number; links: number };
  arc: { positive: number; hard: number; neutral: number; ratio: number };
  values: ValueTheme[];
  withMedia: number;
  firstSaved: string | null;
  ai: {
    embedding: { state: string; model: string; error: string | null };
    llm: { configured: boolean; model: string | null; endpoint: string | null; local: boolean };
    vectors: number;
  };
};

export type Prompt = {
  id: string;
  text: string;
  hint: string;
  category: string;
  feeling: string;
  weight: number;
  group: string;
  answered: boolean;
};
