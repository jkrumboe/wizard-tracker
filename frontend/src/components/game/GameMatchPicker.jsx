import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import gameTemplateService from '@/shared/api/gameTemplateService';
import { safeImageUrl } from '@/shared/utils/gameInfoStore';

// Wait for a pause in typing before asking BGG
const SEARCH_DEBOUNCE_MS = 400;

/** A game from a barcode or name lookup: box art, name, year and whether you have it already */
export const GameCandidate = ({ candidate, inYourGames = false, onPick }) => {
  const { t } = useTranslation();
  const thumbnail = safeImageUrl(candidate.gameInfo?.thumbnailUrl);
  return (
    <button type="button" className="scan-candidate" onClick={onPick}>
      {thumbnail ? (
        <img src={thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" />
      ) : (
        <span className="scan-candidate-placeholder" aria-hidden="true" />
      )}
      <span className="scan-candidate-text">
        <span className="scan-candidate-name">{candidate.name}</span>
        <span className="scan-candidate-meta">
          {[
            candidate.gameInfo?.yearPublished,
            inYourGames && t('scanBarcode.inYourGames'),
          ].filter(Boolean).join(' · ')}
        </span>
      </span>
    </button>
  );
};

/**
 * Look a game name up online and list the matches to pick from.
 * `onNoMatch` is called (once per query) when the lookup finds nothing or is
 * unavailable (logged out, offline, no BGG token); without it a message is shown.
 * @param {{query: string, onPick: Function, onNoMatch?: Function, isInYourGames?: Function}} props
 */
const GameMatchPicker = ({ query, onPick, onNoMatch, isInYourGames, title }) => {
  const { t } = useTranslation();
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  // Callers pass inline callbacks; the lookup shouldn't rerun when they change
  const onNoMatchRef = useRef(onNoMatch);
  onNoMatchRef.current = onNoMatch;

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults(null);
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      const found = await gameTemplateService.searchGames(trimmed);
      if (cancelled) return;
      setResults(found);
      setLoading(false);
      if (!found?.length) onNoMatchRef.current?.();
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  if (loading) return <p className="scan-or-link" role="status">{t('scanBarcode.searchingOnline')}</p>;
  if (results === null && query.trim().length < 2) return null;
  if (!results?.length) {
    if (onNoMatch) return null;
    return (
      <p className="scan-or-link" role="status">
        {results === null ? t('scanBarcode.onlineUnavailable') : t('scanBarcode.noOnlineMatch')}
      </p>
    );
  }

  return (
    <div className="scan-candidates">
      {title && <p className="scan-candidates-title">{title}</p>}
      <div className="scan-candidate-list">
        {results.map((result) => (
          <GameCandidate
            key={result.gameInfo?.bggId || result.name}
            candidate={result}
            inYourGames={Boolean(isInYourGames?.(result.name))}
            onPick={() => onPick(result)}
          />
        ))}
      </div>
    </div>
  );
};

export default GameMatchPicker;
