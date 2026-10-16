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
  return template.gameInfo || readStore()[template.name] || null;
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
