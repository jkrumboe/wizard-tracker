// Box art and BoardGameGeek metadata for game templates (filled from barcode scans).

// Images are rendered for every user, so only accept BGG's own image CDN
const ALLOWED_IMAGE_HOSTS = new Set(['cf.geekdo-images.com']);
const MAX_URL_LENGTH = 500;

// Below this GameUPC confidence an unverified BGG match is only a search guess
const MIN_GAMEUPC_CONFIDENCE = 50;

const sanitizeImageUrl = (value) => {
  if (typeof value !== 'string' || value.length > MAX_URL_LENGTH) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && ALLOWED_IMAGE_HOSTS.has(url.hostname) ? url.href : null;
  } catch {
    return null;
  }
};

const sanitizeInt = (value, max) => {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 && number <= max ? number : null;
};

/**
 * Validate client-supplied game info. Returns null when nothing usable is left,
 * so templates without box art stay clean.
 * @param {Object} input
 * @returns {{bggId, imageUrl, thumbnailUrl, playingTime, minAge, yearPublished}|null}
 */
function sanitizeGameInfo(input) {
  if (!input || typeof input !== 'object') return null;
  const info = {
    bggId: sanitizeInt(input.bggId, 10_000_000),
    imageUrl: sanitizeImageUrl(input.imageUrl),
    thumbnailUrl: sanitizeImageUrl(input.thumbnailUrl),
    playingTime: sanitizeInt(input.playingTime, 10_000),
    minAge: sanitizeInt(input.minAge, 99),
    yearPublished: sanitizeInt(input.yearPublished, 3000),
  };
  return Object.values(info).some((value) => value !== null) ? info : null;
}

/**
 * Pick the BGG entry GameUPC is confident about: the verified one, or a clear
 * top search hit.
 * @param {Object} data - GameUPC /upc/:code response
 * @returns {Object|null} bgg_info item
 */
function pickGameUpcBggItem(data) {
  const items = Array.isArray(data?.bgg_info) ? data.bgg_info : [];
  if (data?.bgg_info_status === 'verified') return items[0] || null;
  const best = [...items].sort((a, b) => (b.confidence || 0) - (a.confidence || 0))[0];
  return best && best.confidence >= MIN_GAMEUPC_CONFIDENCE ? best : null;
}

const MAX_CANDIDATES = 6;

/**
 * The games GameUPC thinks a barcode could be, most likely first, so the user
 * can pick when the match isn't verified.
 * @param {Object} data - GameUPC /upc/:code response
 * @returns {Array<{name: string, gameInfo: Object|null}>}
 */
function listGameUpcCandidates(data) {
  const items = Array.isArray(data?.bgg_info) ? data.bgg_info : [];
  return [...items]
    .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
    .filter((item) => typeof item?.name === 'string' && item.name.trim())
    .slice(0, MAX_CANDIDATES)
    .map((item) => ({
      name: item.name.trim(),
      gameInfo: sanitizeGameInfo({
        bggId: item.id,
        imageUrl: item.image_url,
        thumbnailUrl: item.thumbnail_url,
        yearPublished: item.published,
      }),
    }));
}

const NAMED_ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  mdash: '—', ndash: '–', hellip: '…', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“',
};

// BGG descriptions are double-escaped (e.g. "&amp;#10;" for a newline)
const decodeEntities = (text) => {
  let decoded = text;
  for (let pass = 0; pass < 2; pass += 1) {
    decoded = decoded
      .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
      .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
      .replace(/&([a-z]+);/gi, (match, name) => NAMED_ENTITIES[name.toLowerCase()] ?? match);
  }
  return decoded;
};

const readValue = (xml, tag) => {
  const match = xml.match(new RegExp(`<${tag}\\s+value="([^"]*)"`));
  return match ? match[1] : null;
};

/**
 * Parse the fields we use from a BGG XML API2 /thing response.
 * @param {string} xml
 * @returns {{description, minPlayers, maxPlayers, playingTime, minAge, yearPublished}}
 */
function parseBggThing(xml) {
  const descriptionMatch = xml.match(/<description>([\s\S]*?)<\/description>/);
  const description = descriptionMatch
    ? decodeEntities(descriptionMatch[1]).replace(/\n{3,}/g, '\n\n').trim()
    : '';
  return {
    description,
    minPlayers: sanitizeInt(readValue(xml, 'minplayers'), 100),
    maxPlayers: sanitizeInt(readValue(xml, 'maxplayers'), 100),
    playingTime: sanitizeInt(readValue(xml, 'playingtime'), 10_000),
    minAge: sanitizeInt(readValue(xml, 'minage'), 99),
    yearPublished: sanitizeInt(readValue(xml, 'yearpublished'), 3000),
  };
}

module.exports = {
  sanitizeGameInfo,
  pickGameUpcBggItem,
  listGameUpcCandidates,
  parseBggThing,
};
