import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * Returns a handler that steps back in app history, or replaces the page with
 * `fallback` when it was the first one opened (deep link, shared URL, PWA start).
 *
 * `location.key` is 'default' only for that first entry. `window.history.length`
 * can't tell, since it also counts pages from other sites in the same tab.
 *
 * @param {string} [fallback='/'] Route to open when there is no app history
 * @returns {() => void}
 */
export function useGoBack(fallback = '/') {
  const navigate = useNavigate();
  const { key } = useLocation();

  return useCallback(() => {
    if (key !== 'default') navigate(-1);
    else navigate(fallback, { replace: true });
  }, [key, navigate, fallback]);
}
