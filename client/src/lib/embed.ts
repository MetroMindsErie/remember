/**
 * Turns a music or video URL into an embeddable player URL when we recognise
 * the host. Returns null for anything else, which callers render as a plain
 * link rather than guessing.
 */
export function embedUrl(raw: string): { src: string; kind: 'video' | 'audio' } | null {
  try {
    const u = new URL(raw);
    const host = u.hostname.replace(/^www\./, '');

    if (host === 'youtube.com' || host === 'm.youtube.com') {
      const v = u.searchParams.get('v');
      if (v) return { src: `https://www.youtube.com/embed/${v}`, kind: 'video' };
      if (u.pathname.startsWith('/shorts/')) {
        return { src: `https://www.youtube.com/embed/${u.pathname.split('/')[2]}`, kind: 'video' };
      }
    }
    if (host === 'youtu.be') return { src: `https://www.youtube.com/embed${u.pathname}`, kind: 'video' };
    if (host === 'open.spotify.com') return { src: `https://open.spotify.com/embed${u.pathname}`, kind: 'audio' };
    if (host === 'vimeo.com') return { src: `https://player.vimeo.com/video${u.pathname}`, kind: 'video' };
    if (host === 'music.apple.com') return { src: `https://embed.music.apple.com${u.pathname}${u.search}`, kind: 'audio' };
    if (host === 'soundcloud.com') {
      return { src: `https://w.soundcloud.com/player/?url=${encodeURIComponent(u.toString())}`, kind: 'audio' };
    }
    return null;
  } catch {
    return null;
  }
}

export function hostOf(raw: string) {
  try { return new URL(raw).hostname.replace(/^www\./, ''); } catch { return raw; }
}
