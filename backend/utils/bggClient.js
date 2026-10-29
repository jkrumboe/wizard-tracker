// BoardGameGeek XML API2 requests. BGG requires a registered application token;
// without one, callers keep whatever info they already have.

const BGG_API_TOKEN = process.env.BGG_API_TOKEN || '';

// BGG answers at most this many ids per /thing request
const MAX_THING_IDS = 20;

/**
 * @param {string} path - e.g. "search?query=catan"
 * @returns {Promise<string>} Response XML
 */
async function fetchBggXml(path) {
  const response = await fetch(`https://boardgamegeek.com/xmlapi2/${path}`, {
    headers: { Authorization: `Bearer ${BGG_API_TOKEN}` },
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`BGG responded ${response.status}`);
  return response.text();
}

/**
 * /thing for one or more games, with stats (weight and rating) included.
 * @param {number[]} ids - At most MAX_THING_IDS
 * @returns {Promise<string>} Response XML
 */
const fetchBggThingXml = (ids) => fetchBggXml(`thing?id=${ids.map(encodeURIComponent).join(',')}&stats=1`);

module.exports = {
  BGG_API_TOKEN,
  MAX_THING_IDS,
  fetchBggXml,
  fetchBggThingXml,
};
