import { useEffect, useRef } from 'react';

/**
 * Reveals elements as they enter the viewport.
 *
 * IntersectionObserver rather than a scroll listener, and plain CSS classes
 * rather than an animation library: the only things animated are opacity and
 * transform, which the compositor handles without JavaScript on the frame
 * path. On a mobile-first app that already ships a local ML model, adding an
 * animation runtime to fade some cards in is the wrong trade.
 *
 * The MutationObserver matters more than it looks. Almost every section in
 * this app renders after a fetch resolves, so a one-shot querySelectorAll on
 * mount misses them entirely and they sit at opacity 0 forever, holding their
 * layout space. Watching the subtree catches whatever arrives late.
 *
 * Reduced motion is handled in CSS, where `.reveal` collapses to its visible
 * state, so there is no branch for it here.
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;

    // No observer support: show everything rather than hiding it forever.
    if (typeof IntersectionObserver === 'undefined') {
      root.querySelectorAll('.reveal').forEach((el) => el.classList.add('in'));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add('in');
          io.unobserve(entry.target); // reveal once, never re-hide on scroll up
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.1 }
    );

    const seen = new WeakSet<Element>();
    const scan = () => {
      root.querySelectorAll('.reveal').forEach((el) => {
        if (seen.has(el) || el.classList.contains('in')) return;
        seen.add(el);
        io.observe(el);
      });
    };

    scan();

    const mo = new MutationObserver(scan);
    mo.observe(root, { childList: true, subtree: true });

    return () => { io.disconnect(); mo.disconnect(); };
  }, []);

  return ref;
}
