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

// BGG reports 0 for "no votes yet", so anything below the scale's minimum is unknown
const sanitizeScore = (value, min, max) => {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? Math.round(number * 10) / 10 : null;
};

const sanitizePlayerCounts = (value) => {
  if (!Array.isArray(value)) return null;
  const counts = [...new Set(value.map((count) => sanitizeInt(count, 100)).filter(Boolean))].sort((a, b) => a - b);
  return counts.length ? counts : null;
};

const MAX_DESIGNERS = 3;
const MAX_NAME_LENGTH = 100;

const sanitizeNames = (value) => {
  if (!Array.isArray(value)) return null;
  const names = value
    .filter((name) => typeof name === 'string')
    .map((name) => name.trim())
    .filter((name) => name && name.length <= MAX_NAME_LENGTH)
    .slice(0, MAX_DESIGNERS);
  return names.length ? names : null;
};

/**
 * Validate client-supplied game info. Returns null when nothing usable is left,
 * so templates without box art stay clean.
 * @param {Object} input
 * @returns {{bggId, imageUrl, thumbnailUrl, minPlayers, maxPlayers, bestPlayers, playingTime,
 *   minPlayTime, maxPlayTime, minAge, yearPublished, weight, rating, designers}|null}
 */
function sanitizeGameInfo(input) {
  if (!input || typeof input !== 'object') return null;
  const info = {
    bggId: sanitizeInt(input.bggId, 10_000_000),
    imageUrl: sanitizeImageUrl(input.imageUrl),
    thumbnailUrl: sanitizeImageUrl(input.thumbnailUrl),
    minPlayers: sanitizeInt(input.minPlayers, 100),
    maxPlayers: sanitizeInt(input.maxPlayers, 100),
    bestPlayers: sanitizePlayerCounts(input.bestPlayers),
    playingTime: sanitizeInt(input.playingTime, 10_000),
    minPlayTime: sanitizeInt(input.minPlayTime, 10_000),
    maxPlayTime: sanitizeInt(input.maxPlayTime, 10_000),
    minAge: sanitizeInt(input.minAge, 99),
    yearPublished: sanitizeInt(input.yearPublished, 3000),
    weight: sanitizeScore(input.weight, 1, 5),
    rating: sanitizeScore(input.rating, 1, 10),
    designers: sanitizeNames(input.designers),
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

// Fewer "Best" votes than this for a player count is too thin to call it best
const MIN_BEST_VOTES = 5;

/**
 * Player counts the BGG community voted "Best" for: those where Best got the
 * most votes. Read from the vote counts rather than BGG's English summary text.
 * @param {string} xml
 * @returns {number[]|null}
 */
const parseBestPlayers = (xml) => {
  const poll = xml.match(/<poll\s+name="suggested_numplayers"[^>]*>([\s\S]*?)<\/poll>/)?.[1];
  if (!poll) return null;
  // "6+" style open-ended counts are skipped by the digits-only match
  const best = [...poll.matchAll(/<results\s+numplayers="(\d+)">([\s\S]*?)<\/results>/g)]
    .filter(([, , body]) => {
      const votes = (label) => Number(body.match(new RegExp(String.raw`value="${label}"\s+numvotes="(\d+)"`))?.[1] || 0);
      const bestVotes = votes('Best');
      return bestVotes >= MIN_BEST_VOTES && bestVotes >= votes('Recommended') && bestVotes >= votes('Not Recommended');
    })
    .map(([, count]) => Number(count));
  return sanitizePlayerCounts(best);
};

const readLinks = (xml, type) => [...xml.matchAll(new RegExp(String.raw`<link\s+type="${type}"[^>]*\bvalue="([^"]*)"`, 'g'))]
  .map(([, value]) => decodeEntities(value).trim())
  .filter((value) => value && value !== '(Uncredited)');

/**
 * Parse the fields we use from a BGG XML API2 /thing response. Weight and
 * rating are only there when it was requested with `stats=1`.
 * @param {string} xml
 * @returns {{description, minPlayers, maxPlayers, bestPlayers, playingTime, minPlayTime,
 *   maxPlayTime, minAge, yearPublished, weight, rating, designers}}
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
    bestPlayers: parseBestPlayers(xml),
    playingTime: sanitizeInt(readValue(xml, 'playingtime'), 10_000),
    minPlayTime: sanitizeInt(readValue(xml, 'minplaytime'), 10_000),
    maxPlayTime: sanitizeInt(readValue(xml, 'maxplaytime'), 10_000),
    minAge: sanitizeInt(readValue(xml, 'minage'), 99),
    yearPublished: sanitizeInt(readValue(xml, 'yearpublished'), 3000),
    weight: sanitizeScore(readValue(xml, 'averageweight'), 1, 5),
    rating: sanitizeScore(readValue(xml, 'average'), 1, 10),
    designers: sanitizeNames(readLinks(xml, 'boardgamedesigner')),
  };
}

// Each <item id="…">…</item> of a BGG XML API2 response (items don't nest)
const splitBggItems = (xml) => [...xml.matchAll(/<item\b([^>]*)>([\s\S]*?)<\/item>/g)]
  .map(([, attrs, body]) => ({
    id: sanitizeInt(attrs.match(/\bid="(\d+)"/)?.[1], 10_000_000),
    type: attrs.match(/\btype="([^"]*)"/)?.[1] || null,
    body,
  }))
  .filter((item) => item.id);

const readTagText = (xml, tag) => {
  const match = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  return match ? decodeEntities(match[1]).trim() : null;
};

/**
 * Parse a BGG XML API2 /search response.
 * @param {string} xml
 * @returns {Array<{bggId: number, name: string, yearPublished: number|null}>} Base games only
 */
function parseBggSearch(xml) {
  return splitBggItems(xml)
    .filter((item) => !item.type || item.type === 'boardgame')
    .map((item) => {
      const name = item.body.match(/<name\b[^>]*\bvalue="([^"]*)"/)?.[1];
      return {
        bggId: item.id,
        name: name ? decodeEntities(name).trim() : '',
        yearPublished: sanitizeInt(readValue(item.body, 'yearpublished'), 3000),
      };
    })
    .filter((hit) => hit.name);
}

/**
 * Parse a BGG XML API2 /thing response that may hold several games.
 * @param {string} xml
 * @returns {Map<number, Object>} parseBggThing fields plus imageUrl/thumbnailUrl, by BGG id
 */
function parseBggThings(xml) {
  return new Map(splitBggItems(xml).map((item) => [item.id, {
    ...parseBggThing(item.body),
    imageUrl: readTagText(item.body, 'image'),
    thumbnailUrl: readTagText(item.body, 'thumbnail'),
  }]));
}

const squashName = (text) => String(text).toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

/**
 * Order BGG search hits by how well their name matches the query (exact, prefix,
 * contains), then shorter names (base game before spin-offs), then newer games.
 * BGG lists one hit per matching name, so keep each game's best hit only.
 * @param {Array<{bggId, name, yearPublished}>} hits
 * @param {string} query
 * @returns {Array<{bggId, name, yearPublished}>}
 */
function rankGameSearchResults(hits, query) {
  const target = squashName(query);
  const rank = (name) => {
    const squashed = squashName(name);
    if (squashed === target) return 0;
    if (squashed.startsWith(target)) return 1;
    return squashed.includes(target) ? 2 : 3;
  };
  const sorted = [...hits].sort((a, b) => rank(a.name) - rank(b.name)
    || a.name.length - b.name.length
    || (b.yearPublished || 0) - (a.yearPublished || 0));
  const seen = new Set();
  return sorted.filter((hit) => !seen.has(hit.bggId) && seen.add(hit.bggId));
}

module.exports = {
  sanitizeGameInfo,
  pickGameUpcBggItem,
  listGameUpcCandidates,
  parseBggThing,
  parseBggThings,
  parseBggSearch,
  rankGameSearchResults,
};
