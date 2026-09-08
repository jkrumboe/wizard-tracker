import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

const WIZARD_KEY = 'wizardTracker_localGames';
const ATTEMPTS_KEY = 'keepwiz_upload_attempts';

const createGame = vi.fn();
const createTableGame = vi.fn();

vi.mock('../../api/gameService.js', () => ({
  createGame: (...args) => createGame(...args),
}));

vi.mock('../../api/tableGameService.js', () => ({
  createTableGame: (...args) => createTableGame(...args),
}));

// Table and scoreboard storages are exercised through the wizard path; stub them
// so this suite depends only on the queue's own logic.
vi.mock('../../api/localTableGameStorage.js', () => ({
  LocalTableGameStorage: { getAllSavedTableGames: () => ({}), getTableGameById: () => null, markGameAsUploaded: () => {} },
}));

vi.mock('../../api/localScoreboardGameStorage.js', () => ({
  LocalScoreboardGameStorage: { getAllSavedTableGames: () => ({}), getTableGameById: () => null, markGameAsUploaded: () => {} },
}));

const { listPendingUploads, flushPendingUploads } = await import('../pendingUploads.js');

function buildFinishedGame(overrides = {}) {
  const now = new Date().toISOString();
  return {
    id: 'game-1',
    version: '3.0',
    created_at: now,
    total_rounds: 1,
    players: [
      { id: 'p1', name: 'Alice' },
      { id: 'p2', name: 'Bob' },
    ],
    round_data: [{ players: [{ id: 'p1', made: 1, score: 30 }, { id: 'p2', made: 0, score: 20 }] }],
    gameFinished: true,
    name: 'Finished Game',
    savedAt: now,
    lastPlayed: now,
    isUploaded: false,
    cloudGameId: null,
    ...overrides,
  };
}

function seedGames(games) {
  const byId = {};
  for (const game of games) byId[game.id] = game;
  localStorage.setItem(WIZARD_KEY, JSON.stringify(byId));
}

function storedGames() {
  return JSON.parse(localStorage.getItem(WIZARD_KEY) || '{}');
}

describe('pending upload queue', () => {
  beforeEach(() => {
    localStorage.clear();
    createGame.mockReset();
    createTableGame.mockReset();
    localStorage.setItem('auth_token', 'test-token');
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lists finished games that have not been uploaded', () => {
    seedGames([buildFinishedGame()]);
    const pending = listPendingUploads();
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({ id: 'game-1', kind: 'wizard' });
  });

  it('ignores games that already reached the cloud', () => {
    seedGames([buildFinishedGame({ isUploaded: true, cloudGameId: 'cloud-1' })]);
    expect(listPendingUploads()).toHaveLength(0);
  });

  it('never queues an unfinished game', () => {
    seedGames([buildFinishedGame({ id: 'in-progress', gameFinished: false })]);
    expect(listPendingUploads()).toHaveLength(0);
  });

  it('uploads pending games and marks them as uploaded', async () => {
    seedGames([buildFinishedGame()]);
    createGame.mockResolvedValue({ game: { id: 'cloud-1' } });

    const result = await flushPendingUploads();

    expect(createGame).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ uploaded: 1, failed: 0, remaining: 0 });
    expect(storedGames()['game-1'].isUploaded).toBe(true);
    expect(storedGames()['game-1'].cloudGameId).toBe('cloud-1');
  });

  it('keeps the game queued when the upload fails', async () => {
    seedGames([buildFinishedGame()]);
    createGame.mockRejectedValue(new Error('Failed to fetch'));

    const result = await flushPendingUploads();

    expect(result).toMatchObject({ uploaded: 0, failed: 1, remaining: 1 });
    expect(storedGames()['game-1'].isUploaded).toBe(false);
    expect(listPendingUploads()[0].attempts).toBe(1);
  });

  it('does nothing while offline, leaving the game queued', async () => {
    seedGames([buildFinishedGame()]);
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);

    const result = await flushPendingUploads();

    expect(createGame).not.toHaveBeenCalled();
    expect(result).toMatchObject({ uploaded: 0, remaining: 1, reason: 'offline' });
  });

  it('does not upload while signed out', async () => {
    localStorage.removeItem('auth_token');
    seedGames([buildFinishedGame()]);

    const result = await flushPendingUploads();

    expect(createGame).not.toHaveBeenCalled();
    expect(result).toMatchObject({ reason: 'signed-out', remaining: 1 });
  });

  it('treats a server-side duplicate as uploaded', async () => {
    seedGames([buildFinishedGame()]);
    createGame.mockResolvedValue({ duplicate: true, game: { id: 'cloud-existing' } });

    await flushPendingUploads();

    expect(storedGames()['game-1'].isUploaded).toBe(true);
    expect(storedGames()['game-1'].cloudGameId).toBe('cloud-existing');
  });

  it('stops the run when the session has expired instead of burning attempts', async () => {
    seedGames([buildFinishedGame({ id: 'game-1' }), buildFinishedGame({ id: 'game-2' })]);
    createGame.mockRejectedValue(new Error('Your session has expired. Please sign in again.'));

    const result = await flushPendingUploads();

    expect(createGame).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ uploaded: 0, failed: 1, remaining: 2 });
  });

  it('skips games that used up their automatic attempts, but retries them when forced', async () => {
    seedGames([buildFinishedGame()]);
    localStorage.setItem(ATTEMPTS_KEY, JSON.stringify({ 'game-1': 6 }));
    createGame.mockResolvedValue({ game: { id: 'cloud-1' } });

    const auto = await flushPendingUploads();
    expect(auto).toMatchObject({ uploaded: 0, skipped: 1 });
    expect(createGame).not.toHaveBeenCalled();

    const forced = await flushPendingUploads({ force: true });
    expect(forced).toMatchObject({ uploaded: 1, remaining: 0 });
  });

  it('runs one upload per game when called concurrently', async () => {
    seedGames([buildFinishedGame()]);
    createGame.mockResolvedValue({ game: { id: 'cloud-1' } });

    await Promise.all([flushPendingUploads(), flushPendingUploads(), flushPendingUploads()]);

    expect(createGame).toHaveBeenCalledTimes(1);
  });

  it('forgets attempt counts for games that were deleted', async () => {
    seedGames([buildFinishedGame()]);
    createGame.mockRejectedValue(new Error('Failed to fetch'));
    await flushPendingUploads();
    expect(JSON.parse(localStorage.getItem(ATTEMPTS_KEY))).toHaveProperty('game-1');

    seedGames([]);
    listPendingUploads();

    expect(JSON.parse(localStorage.getItem(ATTEMPTS_KEY))).toEqual({});
  });
});
