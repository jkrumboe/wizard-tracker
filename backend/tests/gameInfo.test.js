const {
  sanitizeGameInfo,
  pickGameUpcBggItem,
  listGameUpcCandidates,
  parseBggThing,
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
    })).toEqual({
      bggId: 1465,
      imageUrl: BGG_IMAGE,
      thumbnailUrl: BGG_IMAGE,
      playingTime: 45,
      minAge: 10,
      yearPublished: 1984,
    });
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
    expect(parseBggThing(xml)).toEqual({
      description: 'Bid & win tricks.\n\n3–6 players — fun',
      minPlayers: 3,
      maxPlayers: 6,
      playingTime: 45,
      minAge: 10,
      yearPublished: 1984,
    });
  });

  test('handles missing fields', () => {
    expect(parseBggThing('<items></items>')).toEqual({
      description: '',
      minPlayers: null,
      maxPlayers: null,
      playingTime: null,
      minAge: null,
      yearPublished: null,
    });
  });
});
