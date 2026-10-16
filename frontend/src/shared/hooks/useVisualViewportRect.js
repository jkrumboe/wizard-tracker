import { useEffect, useState } from 'react';

/*
 * Tracks the part of the page that is actually on screen (the visual
 * viewport) while `active` is true, as { top, height } in CSS pixels.
 *
 * Fixed overlays are laid out against the layout viewport, which classic iOS
 * leaves at full height when the software keyboard opens; it pans the visual
 * viewport instead. A bottom sheet docked to the layout bottom then sits under
 * the keyboard and the pan lands on empty backdrop. Pinning the overlay to this
 * rect keeps the sheet sitting right on top of the keyboard on every browser.
 *
 * Returns null when inactive or when visualViewport is unavailable, so callers
 * fall back to their normal CSS.
 */
export function useVisualViewportRect(active) {
  const [rect, setRect] = useState(null);

  useEffect(() => {
    const viewport = globalThis.visualViewport;
    if (!active || !viewport) {
      setRect(null);
      return undefined;
    }

    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const top = Math.round(viewport.offsetTop);
        const height = Math.round(viewport.height);
        setRect((prev) => (prev && prev.top === top && prev.height === height ? prev : { top, height }));
      });
    };

    update();
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    return () => {
      cancelAnimationFrame(frame);
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
    };
  }, [active]);

  return rect;
}

export default useVisualViewportRect;
