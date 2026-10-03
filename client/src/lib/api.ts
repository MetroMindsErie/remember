import type {
  Memory, MemoryDraft, Facets, Reminder, Story, Lens, Insights, Prompt,
} from './types';

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: init?.body ? { 'Content-Type': 'application/json', ...init?.headers } : init?.headers,
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch { /* non-JSON error body */ }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export type TimelineQuery = {
  q?: string;
  category?: string;
  feeling?: string;
  person?: string;
  tag?: string;
  place?: string;
  sort?: 'newest' | 'oldest';
};

export const api = {
  listMemories(query: TimelineQuery = {}) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) if (v) params.set(k, v);
    const qs = params.toString();
    return req<{ memories: Memory[]; count: number; searched: boolean }>(
      `/memories${qs ? `?${qs}` : ''}`
    );
  },
  getMemory: (id: string) => req<{ memory: Memory }>(`/memories/${id}`),
  createMemory: (draft: Partial<MemoryDraft>) =>
    req<{ memory: Memory }>('/memories', { method: 'POST', body: JSON.stringify(draft) }),
  updateMemory: (id: string, draft: Partial<MemoryDraft>) =>
    req<{ memory: Memory }>(`/memories/${id}`, { method: 'PUT', body: JSON.stringify(draft) }),
  deleteMemory: (id: string) => req<{ deleted: string }>(`/memories/${id}`, { method: 'DELETE' }),

  facets: () => req<Facets>('/facets'),
  prompts: () => req<{ prompts: Prompt[]; groups: string[]; answeredCount: number }>('/prompts'),
  reminder: () => req<{ reminder: Reminder; generatedBy: { embedding: string; llm: string | null } }>('/reflect/reminder'),
  lenses: () => req<{ lenses: Lens[] }>('/reflect/lenses'),
  story: (lensId: string) =>
    req<{ story: Story; lens: Lens; generatedBy: { embedding: string; llm: string | null } }>(
      `/reflect/story/${lensId}`
    ),
  insights: () => req<Insights>('/insights'),
  settings: () => req<{ birthYear: number | null }>('/settings'),
  saveSettings: (birthYear: number | null) =>
    req<{ birthYear: number | null; redated: number }>('/settings', {
      method: 'PUT',
      body: JSON.stringify({ birthYear }),
    }),

  async uploadPhoto(file: File) {
    const form = new FormData();
    form.append('photo', file);
    const res = await fetch('/api/uploads', { method: 'POST', body: form });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || 'Upload failed.');
    }
    return res.json() as Promise<{ url: string; size: number }>;
  },
};
