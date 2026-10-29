// Box art and BoardGameGeek metadata per game, keyed by template name.
// Templates can carry `gameInfo` themselves (synced user/system templates); this
// device store covers built-in and system templates a normal user can't edit.

const STORAGE_KEY = 'wizardTracker_gameInfo';
const ALLOWED_IMAGE_HOSTS = new Set(['cf.geekdo-images.com']);

const readStore = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    console.warn('Could not read game info:', error);
    return {};
  }
};

/**
 * Only render images from BGG's CDN over HTTPS.
 * @param {string} url
 * @returns {string|null}
 */
export const safeImageUrl = (url) => {
  if (typeof url !== 'string') return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && ALLOWED_IMAGE_HOSTS.has(parsed.hostname) ? parsed.href : null;
  } catch {
    return null;
  }
};

/**
 * Remember game info for a template name on this device.
 * @param {string} templateName
 * @param {Object} gameInfo
 */
export const saveGameInfo = (templateName, gameInfo) => {
  if (!templateName || !gameInfo) return;
  try {
    const store = readStore();
    store[templateName] = gameInfo;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch (error) {
    console.warn('Could not save game info:', error);
  }
};

/**
 * Game info for a template: its own, falling back to what this device saved.
 * @param {Object} template
 * @returns {Object|null}
 */
export const getTemplateGameInfo = (template) => {
  if (!template) return null;
  const saved = readStore()[template.name] || null;
  const own = template.gameInfo;
  if (!own || !saved) return own || saved;
  // Details this device filled in for the same game complete what the template carries
  if (own.bggId && saved.bggId && own.bggId !== saved.bggId) return own;
  const known = Object.fromEntries(Object.entries(own).filter(([, value]) => value != null));
  return { ...saved, ...known };
};

const CHECKED_KEY = 'wizardTracker_gameInfoChecked';
// How long a game whose BGG details couldn't be had isn't looked up again
const CHECK_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const readChecked = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(CHECKED_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

/**
 * Remember that a lookup answered for this game, so scans don't keep asking
 * for details that BGG (or the server) doesn't have.
 * @param {string} templateName
 */
export const markGameInfoChecked = (templateName) => {
  if (!templateName) return;
  try {
    const checked = readChecked();
    const now = Date.now();
    // Drop expired entries so the store doesn't grow forever
    const kept = Object.fromEntries(Object.entries(checked).filter(([, at]) => now - at < CHECK_TTL_MS));
    kept[templateName] = now;
    localStorage.setItem(CHECKED_KEY, JSON.stringify(kept));
  } catch (error) {
    console.warn('Could not save game info check:', error);
  }
};

/**
 * @param {string} templateName
 * @returns {boolean} Whether a lookup answered for this game within the last week
 */
export const wasGameInfoCheckedRecently = (templateName) => {
  const at = readChecked()[templateName];
  return typeof at === 'number' && Date.now() - at < CHECK_TTL_MS;
};

/**
 * Thumbnail (or full image) URL to show for a template, if any.
 * @param {Object} template
 * @param {'thumbnail'|'image'} [size='thumbnail']
 * @returns {string|null}
 */
export const getTemplateImageUrl = (template, size = 'thumbnail') => {
  const info = getTemplateGameInfo(template);
  if (!info) return null;
  const preferred = size === 'image' ? info.imageUrl : info.thumbnailUrl;
  return safeImageUrl(preferred) || safeImageUrl(info.thumbnailUrl) || safeImageUrl(info.imageUrl);
};
