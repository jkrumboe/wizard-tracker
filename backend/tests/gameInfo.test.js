const {
  sanitizeGameInfo,
  pickGameUpcBggItem,
  listGameUpcCandidates,
  parseBggThing,
  parseBggThings,
  parseBggSearch,
  rankGameSearchResults,
} = require('../utils/gameInfo');

const BGG_IMAGE = 'https://cf.geekdo-images.com/abc__thumb/img/x.jpg';

describe('sanitizeGameInfo', () => {
  test('keeps BGG CDN images and valid numbers', () => {
    expect(sanitizeGameInfo({
      bggId: 1465,
      imageUrl: BGG_IMAGE,
      thumbnailUrl: BGG_IMAGE,
      playingTime: 45,
      minAge: 10,
      yearPublished: '1984',
    })).toMatchObject({
      bggId: 1465,
      imageUrl: BGG_IMAGE,
      thumbnailUrl: BGG_IMAGE,
      playingTime: 45,
      minAge: 10,
      yearPublished: 1984,
    });
  });

  test('keeps player counts, scores and designers within range', () => {
    expect(sanitizeGameInfo({
      minPlayers: 3,
      maxPlayers: 6,
      bestPlayers: [5, 4, 4, 0, 'x'],
      weight: 1.6974,
      rating: '7.01203',
      designers: ['Ken Fisher', '', 42, 'A', 'B', 'C'],
    })).toMatchObject({
      minPlayers: 3,
      maxPlayers: 6,
      bestPlayers: [4, 5],
      weight: 1.7,
      rating: 7,
      designers: ['Ken Fisher', 'A', 'B'],
    });
    expect(sanitizeGameInfo({ bggId: 1, weight: 0, rating: 11, bestPlayers: [], designers: [] }))
      .toMatchObject({ weight: null, rating: null, bestPlayers: null, designers: null });
  });

  test('drops images from other hosts and non-https or script URLs', () => {
    const info = sanitizeGameInfo({
      bggId: 13,
      imageUrl: 'https://evil.example/tracker.png',
      thumbnailUrl: 'javascript:alert(1)',
    });
    expect(info.imageUrl).toBeNull();
    expect(info.thumbnailUrl).toBeNull();
    expect(sanitizeGameInfo({ imageUrl: 'http://cf.geekdo-images.com/x.jpg' })).toBeNull();
  });

  test('returns null when nothing usable is left', () => {
    expect(sanitizeGameInfo(null)).toBeNull();
    expect(sanitizeGameInfo('nope')).toBeNull();
    expect(sanitizeGameInfo({ bggId: -1, playingTime: 'abc' })).toBeNull();
  });
});

describe('pickGameUpcBggItem', () => {
  test('uses the verified match', () => {
    const data = { bgg_info_status: 'verified', bgg_info: [{ id: 1465, confidence: 0 }] };
    expect(pickGameUpcBggItem(data).id).toBe(1465);
  });

  test('uses a confident top hit when unverified', () => {
    const data = {
      bgg_info_status: 'choose_from_bgg_info_or_search',
      bgg_info: [{ id: 278, confidence: 11 }, { id: 13, confidence: 63 }],
    };
    expect(pickGameUpcBggItem(data).id).toBe(13);
  });

  test('ignores low-confidence guesses', () => {
    const data = { bgg_info_status: 'choose_from_bgg_info_or_search', bgg_info: [{ id: 5, confidence: 20 }] };
    expect(pickGameUpcBggItem(data)).toBeNull();
    expect(pickGameUpcBggItem({})).toBeNull();
  });
});

describe('listGameUpcCandidates', () => {
  test('lists the likeliest games first with sanitized box art', () => {
    const candidates = listGameUpcCandidates({
      bgg_info: [
        { id: 278, name: 'Catan Card Game', published: '1996', confidence: 11, thumbnail_url: BGG_IMAGE },
        { id: 13, name: 'Catan', published: '1995', confidence: 63, thumbnail_url: 'https://evil.example/x.png' },
        { id: 99, name: '   ', confidence: 90 },
      ],
    });
    expect(candidates.map((c) => c.name)).toEqual(['Catan', 'Catan Card Game']);
    expect(candidates[0].gameInfo).toMatchObject({ bggId: 13, thumbnailUrl: null, yearPublished: 1995 });
    expect(candidates[1].gameInfo.thumbnailUrl).toBe(BGG_IMAGE);
  });

  test('caps the list and handles missing data', () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ id: i + 1, name: `Game ${i}`, confidence: i }));
    expect(listGameUpcCandidates({ bgg_info: many })).toHaveLength(6);
    expect(listGameUpcCandidates({})).toEqual([]);
  });
});

describe('parseBggThing', () => {
  test('reads fields and decodes double-escaped entities', () => {
    const xml = `<items><item type="boardgame" id="1465">
      <description>Bid &amp;amp; win tricks.&amp;#10;&amp;#10;&amp;#10;3&amp;ndash;6 players &amp;mdash; fun</description>
      <yearpublished value="1984" />
      <minplayers value="3" />
      <maxplayers value="6" />
      <playingtime value="45" />
      <minage value="10" />
    </item></items>`;
    expect(parseBggThing(xml)).toMatchObject({
      description: 'Bid & win tricks.\n\n3–6 players — fun',
      minPlayers: 3,
      maxPlayers: 6,
      playingTime: 45,
      minAge: 10,
      yearPublished: 1984,
    });
  });

  test('reads best player counts from the poll votes, plus stats and designers', () => {
    const results = (count, best, recommended, notRecommended) => `
      <results numplayers="${count}">
        <result value="Best" numvotes="${best}" />
        <result value="Recommended" numvotes="${recommended}" />
        <result value="Not Recommended" numvotes="${notRecommended}" />
      </results>`;
    const xml = `<items><item type="boardgame" id="1465">
      <poll name="suggested_numplayers" title="User Suggested Number of Players" totalvotes="206">
        ${results(3, 31, 101, 47)}${results(4, 142, 53, 1)}${results(5, 111, 75, 3)}
        ${results(6, 49, 104, 25)}${results('6+', 300, 6, 1)}
      </poll>
      <minplaytime value="30" /><maxplaytime value="60" />
      <link type="boardgamedesigner" id="618" value="Ken Fisher" />
      <link type="boardgamedesigner" id="3" value="(Uncredited)" />
      <link type="boardgameartist" id="11883" value="Franz Vohwinkel" />
      <statistics page="1"><ratings>
        <average value="7.01203" /><bayesaverage value="6.73976" />
        <averageweight value="1.6974" />
      </ratings></statistics>
    </item></items>`;
    expect(parseBggThing(xml)).toMatchObject({
      bestPlayers: [4, 5],
      minPlayTime: 30,
      maxPlayTime: 60,
      rating: 7,
      weight: 1.7,
      designers: ['Ken Fisher'],
    });
  });

  test('ignores best votes too thin to count', () => {
    const xml = `<poll name="suggested_numplayers"><results numplayers="2">
      <result value="Best" numvotes="2" /><result value="Recommended" numvotes="0" />
      <result value="Not Recommended" numvotes="0" /></results></poll>`;
    expect(parseBggThing(xml).bestPlayers).toBeNull();
  });

  test('handles missing fields', () => {
    expect(parseBggThing('<items></items>')).toEqual({
      description: '',
      minPlayers: null,
      maxPlayers: null,
      bestPlayers: null,
      playingTime: null,
      minPlayTime: null,
      maxPlayTime: null,
      minAge: null,
      yearPublished: null,
      weight: null,
      rating: null,
      designers: null,
    });
  });
});

describe('parseBggSearch', () => {
  test('reads base games with names and years, skipping expansions', () => {
    const xml = `<items total="3">
      <item type="boardgame" id="13"><name type="primary" value="Catan"/><yearpublished value="1995"/></item>
      <item type="boardgameexpansion" id="926"><name type="primary" value="Catan: Seafarers"/></item>
      <item type="boardgame" id="27710"><name type="alternate" value="Catan &amp;amp; Friends"/></item>
    </items>`;
    expect(parseBggSearch(xml)).toEqual([
      { bggId: 13, name: 'Catan', yearPublished: 1995 },
      { bggId: 27710, name: 'Catan & Friends', yearPublished: null },
    ]);
  });
});

describe('parseBggThings', () => {
  test('reads each game with its images', () => {
    const xml = `<items>
      <item type="boardgame" id="13">
        <thumbnail>${BGG_IMAGE}</thumbnail>
        <image>${BGG_IMAGE}</image>
        <minplayers value="3" /><maxplayers value="4" />
      </item>
      <item type="boardgame" id="1465"><minplayers value="3" /></item>
    </items>`;
    const things = parseBggThings(xml);
    expect(things.get(13)).toMatchObject({ thumbnailUrl: BGG_IMAGE, imageUrl: BGG_IMAGE, minPlayers: 3, maxPlayers: 4 });
    expect(things.get(1465)).toMatchObject({ thumbnailUrl: null, minPlayers: 3, maxPlayers: null });
  });
});

describe('rankGameSearchResults', () => {
  test('puts exact, then prefix matches first and keeps one hit per game', () => {
    const hits = [
      { bggId: 3, name: 'Star Wars: Catan', yearPublished: 2014 },
      { bggId: 2, name: 'Catan Junior', yearPublished: 2007 },
      { bggId: 1, name: 'Die Siedler von Catan', yearPublished: 1995 },
      { bggId: 1, name: 'CATAN', yearPublished: 1995 },
    ];
    expect(rankGameSearchResults(hits, 'catan').map((hit) => hit.name))
      .toEqual(['CATAN', 'Catan Junior', 'Star Wars: Catan']);
  });
});
