import { useCallback, useState } from 'react';

/*
 * Tracks whether a scroll region has moved away from its top, so the chrome
 * above it can react (e.g. a tab bar squaring its corners to join the content
 * sliding under it). Returns a callback ref because the region often mounts
 * late, after data has loaded.
 */
export function useIsScrolled(threshold = 1) {
  const [isScrolled, setIsScrolled] = useState(false);

  const ref = useCallback((node) => {
    if (!node) return undefined;
    const update = () => setIsScrolled(node.scrollTop > threshold);
    update();
    node.addEventListener('scroll', update, { passive: true });
    return () => node.removeEventListener('scroll', update);
  }, [threshold]);

  return [ref, isScrolled];
}
