const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Relative "last played" label: "today", "yesterday", "3 days ago", "2 months ago".
 * @param {Date|string|number} value - When the game was played
 * @param {string} language - Locale for Intl.RelativeTimeFormat
 * @returns {string}
 */
export const formatLastPlayed = (value, language) => {
  const date = new Date(value);
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const days = Math.round((startOfDay(new Date()) - startOfDay(date)) / DAY_MS);
  if (Number.isNaN(days) || days < 0) return date.toLocaleDateString(language);

  const rtf = new Intl.RelativeTimeFormat(language, { numeric: 'auto' });
  if (days <= 30) return rtf.format(-days, 'day');
  if (days < 365) return rtf.format(-Math.round(days / 30), 'month');
  return rtf.format(-Math.round(days / 365), 'year');
};
