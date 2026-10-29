/**
 * ELO Service Unit Tests
 * 
 * Tests the core ELO calculation logic and rating system
 */

const mongoose = require('mongoose');
const eloService = require('../utils/eloService');

// Mock PlayerIdentity for testing
const createMockIdentity = (id, options = {}) => ({
  _id: id,
  displayName: options.displayName || `Player ${id}`,
  eloByGameType: options.eloByGameType || new Map(),
  isDeleted: false
});

describe('ELO Service', () => {
  describe('CONFIG', () => {
    it('should have default rating of 1000', () => {
      expect(eloService.CONFIG.DEFAULT_RATING).toBe(1000);
    });

    it('should have minimum rating of 100', () => {
      expect(eloService.CONFIG.MIN_RATING).toBe(100);
    });

    it('should have proper K-factor thresholds', () => {
      expect(eloService.CONFIG.K_FACTOR.NEW_PLAYER).toBe(32);
      expect(eloService.CONFIG.K_FACTOR.DEVELOPING).toBe(24);
      expect(eloService.CONFIG.K_FACTOR.ESTABLISHED).toBe(20);
      expect(eloService.CONFIG.K_FACTOR.VETERAN).toBe(16);
    });

    it('should require 5 games for ranking', () => {
      expect(eloService.CONFIG.MIN_GAMES_FOR_RANKING).toBe(5);
    });

    it('should have per-game change cap of 50', () => {
      expect(eloService.CONFIG.MAX_CHANGE_PER_GAME).toBe(50);
    });

    it('should have loss margin cap of 0.10', () => {
      expect(eloService.CONFIG.MARGIN_LOSS_MAX).toBe(0.10);
    });

    it('should have provisional dampening of 0.5', () => {
      expect(eloService.CONFIG.PROVISIONAL_DAMPENING).toBe(0.5);
    });
  });

  describe('normalizeGameType', () => {
    it('should normalize game type to lowercase', () => {
      expect(eloService.normalizeGameType('Wizard')).toBe('wizard');
      expect(eloService.normalizeGameType('FLIP-7')).toBe('flip7');
    });

    it('should give every spelling of one game the same key', () => {
      expect(eloService.normalizeGameType('Flip 7')).toBe('flip7');
      expect(eloService.normalizeGameType('Flip7')).toBe('flip7');
      expect(eloService.normalizeGameType('flip-7')).toBe('flip7');
      expect(eloService.normalizeGameType('My Game Type')).toBe('mygametype');
    });

    it('should drop accents but keep other letters', () => {
      expect(eloService.normalizeGameType('Mölkky')).toBe('molkky');
      expect(eloService.normalizeGameType('6 nimmt!')).toBe('6nimmt');
    });

    it('should trim whitespace', () => {
      expect(eloService.normalizeGameType('  wizard  ')).toBe('wizard');
    });

    it('should return "unknown" for null/undefined', () => {
      expect(eloService.normalizeGameType(null)).toBe('unknown');
      expect(eloService.normalizeGameType(undefined)).toBe('unknown');
    });
  });

  describe('getKFactor', () => {
    it('should return 32 for new players (< 10 games)', () => {
      expect(eloService.getKFactor(0)).toBe(32);
      expect(eloService.getKFactor(5)).toBe(32);
      expect(eloService.getKFactor(9)).toBe(32);
    });

    it('should return 24 for developing players (10-29 games)', () => {
      expect(eloService.getKFactor(10)).toBe(24);
      expect(eloService.getKFactor(20)).toBe(24);
      expect(eloService.getKFactor(29)).toBe(24);
    });

    it('should return 20 for established players (30-99 games)', () => {
      expect(eloService.getKFactor(30)).toBe(20);
      expect(eloService.getKFactor(50)).toBe(20);
      expect(eloService.getKFactor(99)).toBe(20);
    });

    it('should return 16 for veteran players (100+ games)', () => {
      expect(eloService.getKFactor(100)).toBe(16);
      expect(eloService.getKFactor(500)).toBe(16);
    });
  });

  describe('getEloForGameType', () => {
    it('should return default ELO for new players', () => {
      const identity = createMockIdentity('player1');
      const elo = eloService.getEloForGameType(identity, 'wizard');
      
      expect(elo.rating).toBe(1000);
      expect(elo.peak).toBe(1000);
      expect(elo.floor).toBe(1000);
      expect(elo.gamesPlayed).toBe(0);
      expect(elo.streak).toBe(0);
    });

    it('should return stored ELO for existing players', () => {
      const eloByGameType = new Map();
      eloByGameType.set('wizard', {
        rating: 1200,
        peak: 1250,
        floor: 950,
        gamesPlayed: 25,
        streak: 3
      });
      
      const identity = createMockIdentity('player1', { eloByGameType });
      const elo = eloService.getEloForGameType(identity, 'wizard');
      
      expect(elo.rating).toBe(1200);
      expect(elo.peak).toBe(1250);
      expect(elo.gamesPlayed).toBe(25);
    });

    it('should normalize game type when looking up', () => {
      const eloByGameType = new Map();
      eloByGameType.set('flip7', { rating: 1100, gamesPlayed: 5 });
      
      const identity = createMockIdentity('player1', { eloByGameType });
      const elo = eloService.getEloForGameType(identity, 'Flip 7');
      
      expect(elo.rating).toBe(1100);
    });
  });

  describe('getPlacementScore', () => {
    it('should return 0.5 for tied placements', () => {
      expect(eloService.getPlacementScore(1, 1, 4)).toBe(0.5);
      expect(eloService.getPlacementScore(3, 3, 6)).toBe(0.5);
    });

    it('should return 1.0 for 1st vs last in any game size', () => {
      expect(eloService.getPlacementScore(1, 2, 2)).toBe(1.0);
      expect(eloService.getPlacementScore(1, 4, 4)).toBe(1.0);
      expect(eloService.getPlacementScore(1, 6, 6)).toBe(1.0);
    });

    it('should return 0.0 for last vs 1st in any game size', () => {
      expect(eloService.getPlacementScore(2, 1, 2)).toBe(0.0);
      expect(eloService.getPlacementScore(4, 1, 4)).toBe(0.0);
      expect(eloService.getPlacementScore(6, 1, 6)).toBe(0.0);
    });

    it('should give fractional scores based on placement gap', () => {
      // 6-player game: 2nd vs 1st should be close to 0.5 (not 0)
      const secondVsFirst = eloService.getPlacementScore(2, 1, 6);
      expect(secondVsFirst).toBeCloseTo(0.4, 1);
      
      // 6-player game: 2nd vs 6th should be close to 1.0
      const secondVsLast = eloService.getPlacementScore(2, 6, 6);
      expect(secondVsLast).toBeCloseTo(0.9, 1);
    });
  });

  describe('getProvisionalDampening', () => {
    it('should return 1.0 when both players are new', () => {
      expect(eloService.getProvisionalDampening(5, 3)).toBe(1.0);
    });

    it('should return 1.0 when both players are established', () => {
      expect(eloService.getProvisionalDampening(50, 30)).toBe(1.0);
    });

    it('should dampen when established player faces new player', () => {
      expect(eloService.getProvisionalDampening(50, 3)).toBe(0.5);
    });

    it('should not dampen when new player faces established player', () => {
      expect(eloService.getProvisionalDampening(3, 50)).toBe(1.0);
    });
  });

  describe('calculateGameEloChanges', () => {
    it('should return empty array for unfinished games', () => {
      const gameData = { gameFinished: false, players: [] };
      const result = eloService.calculateGameEloChanges(gameData, new Map(), 'wizard');
      expect(result).toEqual([]);
    });

    it('should return empty array for games with less than 2 players', () => {
      const gameData = { 
        gameFinished: true, 
        players: [{ id: 'p1', name: 'Player 1', identityId: 'id1' }],
        final_scores: { p1: 100 }
      };
      const result = eloService.calculateGameEloChanges(gameData, new Map(), 'wizard');
      expect(result).toEqual([]);
    });

    it('should calculate ELO changes for a 2-player game', () => {
      const player1Id = new mongoose.Types.ObjectId().toString();
      const player2Id = new mongoose.Types.ObjectId().toString();
      
      const gameData = {
        gameFinished: true,
        players: [
          { id: 'p1', name: 'Alice', identityId: player1Id },
          { id: 'p2', name: 'Bob', identityId: player2Id }
        ],
        final_scores: { p1: 120, p2: 80 },
        winner_id: 'p1'
      };
      
      const identityMap = new Map();
      identityMap.set(player1Id, createMockIdentity(player1Id, { displayName: 'Alice' }));
      identityMap.set(player2Id, createMockIdentity(player2Id, { displayName: 'Bob' }));
      
      const result = eloService.calculateGameEloChanges(gameData, identityMap, 'wizard');
      
      expect(result).toHaveLength(2);
      
      // Winner (Alice) should gain rating
      const aliceResult = result.find(r => r.playerName === 'Alice');
      expect(aliceResult.placement).toBe(1);
      expect(aliceResult.won).toBe(true);
      expect(aliceResult.change).toBeGreaterThan(0);
      expect(aliceResult.newRating).toBeGreaterThan(1000);
      
      // Loser (Bob) should lose rating
      const bobResult = result.find(r => r.playerName === 'Bob');
      expect(bobResult.placement).toBe(2);
      expect(bobResult.won).toBe(false);
      expect(bobResult.change).toBeLessThan(0);
      expect(bobResult.newRating).toBeLessThan(1000);
    });

    it('should calculate ELO changes for a 4-player game', () => {
      const playerIds = [
        new mongoose.Types.ObjectId().toString(),
        new mongoose.Types.ObjectId().toString(),
        new mongoose.Types.ObjectId().toString(),
        new mongoose.Types.ObjectId().toString()
      ];
      
      const gameData = {
        gameFinished: true,
        players: [
          { id: 'p1', name: 'Alice', identityId: playerIds[0] },
          { id: 'p2', name: 'Bob', identityId: playerIds[1] },
          { id: 'p3', name: 'Charlie', identityId: playerIds[2] },
          { id: 'p4', name: 'Diana', identityId: playerIds[3] }
        ],
        final_scores: { p1: 150, p2: 100, p3: 75, p4: 50 },
        winner_id: 'p1'
      };
      
      const identityMap = new Map();
      identityMap.set(playerIds[0], createMockIdentity(playerIds[0], { displayName: 'Alice' }));
      identityMap.set(playerIds[1], createMockIdentity(playerIds[1], { displayName: 'Bob' }));
      identityMap.set(playerIds[2], createMockIdentity(playerIds[2], { displayName: 'Charlie' }));
      identityMap.set(playerIds[3], createMockIdentity(playerIds[3], { displayName: 'Diana' }));
      
      const result = eloService.calculateGameEloChanges(gameData, identityMap, 'wizard');
      
      expect(result).toHaveLength(4);
      
      // Check placements are correct
      const placements = result.map(r => ({ name: r.playerName, placement: r.placement }));
      expect(placements).toContainEqual({ name: 'Alice', placement: 1 });
      expect(placements).toContainEqual({ name: 'Bob', placement: 2 });
      expect(placements).toContainEqual({ name: 'Charlie', placement: 3 });
      expect(placements).toContainEqual({ name: 'Diana', placement: 4 });
      
      // First place should gain, last place should lose
      const alice = result.find(r => r.playerName === 'Alice');
      const diana = result.find(r => r.playerName === 'Diana');
      expect(alice.change).toBeGreaterThan(0);
      expect(diana.change).toBeLessThan(0);
    });

    it('should handle ties correctly', () => {
      const player1Id = new mongoose.Types.ObjectId().toString();
      const player2Id = new mongoose.Types.ObjectId().toString();
      const player3Id = new mongoose.Types.ObjectId().toString();
      
      const gameData = {
        gameFinished: true,
        players: [
          { id: 'p1', name: 'Alice', identityId: player1Id },
          { id: 'p2', name: 'Bob', identityId: player2Id },
          { id: 'p3', name: 'Charlie', identityId: player3Id }
        ],
        final_scores: { p1: 100, p2: 100, p3: 50 }, // Alice and Bob tie
        winner_id: 'p1'
      };
      
      const identityMap = new Map();
      identityMap.set(player1Id, createMockIdentity(player1Id, { displayName: 'Alice' }));
      identityMap.set(player2Id, createMockIdentity(player2Id, { displayName: 'Bob' }));
      identityMap.set(player3Id, createMockIdentity(player3Id, { displayName: 'Charlie' }));
      
      const result = eloService.calculateGameEloChanges(gameData, identityMap, 'wizard');
      
      // Alice and Bob should have the same placement (1st)
      const alice = result.find(r => r.playerName === 'Alice');
      const bob = result.find(r => r.playerName === 'Bob');
      expect(alice.placement).toBe(1);
      expect(bob.placement).toBe(1);
    });

    it('should respect minimum rating floor', () => {
      const player1Id = new mongoose.Types.ObjectId().toString();
      const player2Id = new mongoose.Types.ObjectId().toString();
      
      // Player 2 starts with very low rating
      const eloByGameType = new Map();
      eloByGameType.set('wizard', { rating: 110, gamesPlayed: 5 });
      
      const gameData = {
        gameFinished: true,
        players: [
          { id: 'p1', name: 'Alice', identityId: player1Id },
          { id: 'p2', name: 'Bob', identityId: player2Id }
        ],
        final_scores: { p1: 200, p2: 10 }, // Big loss for Bob
        winner_id: 'p1'
      };
      
      const identityMap = new Map();
      identityMap.set(player1Id, createMockIdentity(player1Id, { displayName: 'Alice' }));
      identityMap.set(player2Id, createMockIdentity(player2Id, { 
        displayName: 'Bob', 
        eloByGameType 
      }));
      
      const result = eloService.calculateGameEloChanges(gameData, identityMap, 'wizard');
      
      const bob = result.find(r => r.playerName === 'Bob');
      // Should not go below minimum rating
      expect(bob.newRating).toBeGreaterThanOrEqual(eloService.CONFIG.MIN_RATING);
    });

    it('should apply higher K-factor for new players', () => {
      const newPlayerId = new mongoose.Types.ObjectId().toString();
      const veteranPlayerId = new mongoose.Types.ObjectId().toString();
      
      // Veteran player with many games
      const veteranElo = new Map();
      veteranElo.set('wizard', { rating: 1000, gamesPlayed: 150 });
      
      const gameData = {
        gameFinished: true,
        players: [
          { id: 'p1', name: 'NewPlayer', identityId: newPlayerId },
          { id: 'p2', name: 'Veteran', identityId: veteranPlayerId }
        ],
        final_scores: { p1: 100, p2: 80 },
        winner_id: 'p1'
      };
      
      const identityMap = new Map();
      identityMap.set(newPlayerId, createMockIdentity(newPlayerId, { displayName: 'NewPlayer' }));
      identityMap.set(veteranPlayerId, createMockIdentity(veteranPlayerId, { 
        displayName: 'Veteran',
        eloByGameType: veteranElo
      }));
      
      const result = eloService.calculateGameEloChanges(gameData, identityMap, 'wizard');
      
      const newPlayer = result.find(r => r.playerName === 'NewPlayer');
      const veteran = result.find(r => r.playerName === 'Veteran');
      
      // New player should have larger rating change (higher K-factor)
      expect(Math.abs(newPlayer.change)).toBeGreaterThan(Math.abs(veteran.change));
    });

    it('should skip players without identityId', () => {
      const player1Id = new mongoose.Types.ObjectId().toString();
      const player2Id = new mongoose.Types.ObjectId().toString();
      
      const gameData = {
        gameFinished: true,
        players: [
          { id: 'p1', name: 'Alice', identityId: player1Id },
          { id: 'p2', name: 'GuestWithNoId' }, // No identityId
          { id: 'p3', name: 'Bob', identityId: player2Id }
        ],
        final_scores: { p1: 100, p2: 80, p3: 60 },
        winner_id: 'p1'
      };

      const identityMap = new Map();
      identityMap.set(player1Id, createMockIdentity(player1Id, { displayName: 'Alice' }));
      identityMap.set(player2Id, createMockIdentity(player2Id, { displayName: 'Bob' }));

      const result = eloService.calculateGameEloChanges(gameData, identityMap, 'wizard');

      // Only rated players get a result; the guest still holds 2nd place
      expect(result.map(r => r.playerName).sort()).toEqual(['Alice', 'Bob']);
      expect(result.find(r => r.playerName === 'Bob').placement).toBe(3);
    });

    it('should not rate a player who has no rated opponents', () => {
      const player1Id = new mongoose.Types.ObjectId().toString();

      const gameData = {
        gameFinished: true,
        players: [
          { id: 'p1', name: 'Alice', identityId: player1Id },
          { id: 'p2', name: 'GuestWithNoId' }
        ],
        final_scores: { p1: 100, p2: 80 },
        winner_id: 'p1'
      };

      const identityMap = new Map();
      identityMap.set(player1Id, createMockIdentity(player1Id, { displayName: 'Alice' }));

      expect(eloService.calculateGameEloChanges(gameData, identityMap, 'wizard')).toEqual([]);
    });

    it('should not throw when an opponent identity is missing (deleted or merged)', () => {
      const aliceId = new mongoose.Types.ObjectId().toString();
      const bobId = new mongoose.Types.ObjectId().toString();
      const deletedId = new mongoose.Types.ObjectId().toString();

      const gameData = {
        gameFinished: true,
        players: [
          { id: 'p1', name: 'Alice', identityId: aliceId },
          { id: 'p2', name: 'Bob', identityId: bobId },
          { id: 'p3', name: 'Gone', identityId: deletedId } // not in the map
        ],
        final_scores: { p1: 100, p2: 80, p3: 60 },
        winner_id: 'p1'
      };

      const identityMap = new Map();
      identityMap.set(aliceId, createMockIdentity(aliceId, { displayName: 'Alice' }));
      identityMap.set(bobId, createMockIdentity(bobId, { displayName: 'Bob' }));

      const result = eloService.calculateGameEloChanges(gameData, identityMap, 'wizard');
      expect(result).toHaveLength(2);
    });
  });

  describe('ELO Math Validation', () => {
    it('should sum to approximately zero for equal-rated players', () => {
      const playerIds = [
        new mongoose.Types.ObjectId().toString(),
        new mongoose.Types.ObjectId().toString(),
        new mongoose.Types.ObjectId().toString()
      ];
      
      const gameData = {
        gameFinished: true,
        players: [
          { id: 'p1', name: 'Alice', identityId: playerIds[0] },
          { id: 'p2', name: 'Bob', identityId: playerIds[1] },
          { id: 'p3', name: 'Charlie', identityId: playerIds[2] }
        ],
        final_scores: { p1: 100, p2: 80, p3: 60 },
        winner_id: 'p1'
      };
      
      const identityMap = new Map();
      playerIds.forEach((id, i) => {
        identityMap.set(id, createMockIdentity(id, { displayName: ['Alice', 'Bob', 'Charlie'][i] }));
      });
      
      const result = eloService.calculateGameEloChanges(gameData, identityMap, 'wizard');
      
      // Sum of all rating changes should be close to zero
      // Note: The loser's margin multiplier is capped lower than the winner's,
      // and changes are rounded, so there can be a small imbalance
      const totalChange = result.reduce((sum, r) => sum + r.change, 0);
      expect(Math.abs(totalChange)).toBeLessThanOrEqual(3);
    });

    it('should give larger gains when beating higher-rated opponents', () => {
      const lowRatedId = new mongoose.Types.ObjectId().toString();
      const highRatedId = new mongoose.Types.ObjectId().toString();
      
      const highElo = new Map();
      highElo.set('wizard', { rating: 1400, gamesPlayed: 50 });
      
      const gameData = {
        gameFinished: true,
        players: [
          { id: 'p1', name: 'Underdog', identityId: lowRatedId },
          { id: 'p2', name: 'Favorite', identityId: highRatedId }
        ],
        final_scores: { p1: 100, p2: 80 }, // Underdog wins!
        winner_id: 'p1'
      };
      
      const identityMap = new Map();
      identityMap.set(lowRatedId, createMockIdentity(lowRatedId, { displayName: 'Underdog' }));
      identityMap.set(highRatedId, createMockIdentity(highRatedId, { 
        displayName: 'Favorite',
        eloByGameType: highElo
      }));
      
      const result = eloService.calculateGameEloChanges(gameData, identityMap, 'wizard');
      
      const underdog = result.find(r => r.playerName === 'Underdog');
      
      // Underdog beating a much higher-rated player should gain significantly
      expect(underdog.change).toBeGreaterThan(5); // More than standard expected
    });
  });
  describe('score margin', () => {
    const playTwoPlayerGame = (aliceScore, bobScore, gameType = 'wizard', extra = {}) => {
      const aliceId = new mongoose.Types.ObjectId().toString();
      const bobId = new mongoose.Types.ObjectId().toString();
      const identityMap = new Map([
        [aliceId, createMockIdentity(aliceId, { displayName: 'Alice' })],
        [bobId, createMockIdentity(bobId, { displayName: 'Bob' })]
      ]);
      const result = eloService.calculateGameEloChanges({
        gameFinished: true,
        players: [
          { id: 'p1', name: 'Alice', identityId: aliceId },
          { id: 'p2', name: 'Bob', identityId: bobId }
        ],
        final_scores: { p1: aliceScore, p2: bobScore },
        ...extra
      }, identityMap, gameType);
      return {
        alice: result.find(r => r.playerName === 'Alice'),
        bob: result.find(r => r.playerName === 'Bob')
      };
    };

    it("grows the winner's gain with the margin", () => {
      const close = playTwoPlayerGame(105, 100);
      const blowout = playTwoPlayerGame(200, 100);
      expect(blowout.alice.change).toBeGreaterThan(close.alice.change);
    });

    it('makes a blowout loss cost more than a close loss, never less', () => {
      const close = playTwoPlayerGame(105, 100);
      const blowout = playTwoPlayerGame(200, 100);
      expect(blowout.bob.change).toBeLessThan(close.bob.change);
    });

    it("caps the loser's extra loss below the winner's extra gain", () => {
      const { alice, bob } = playTwoPlayerGame(200, 100);
      expect(Math.abs(bob.change)).toBeLessThanOrEqual(Math.abs(alice.change));
    });

    it('uses absolute points for Wizard', () => {
      expect(eloService.getMarginBonus(160, 100, 'wizard')).toBe(eloService.CONFIG.MARGIN_BONUS.BLOWOUT);
      expect(eloService.getMarginBonus(105, 100, 'wizard')).toBe(0);
    });

    it('uses a relative margin for other games', () => {
      // Dutch ends in single digits - 5 vs 30 is a blowout, not "under 10 points"
      expect(eloService.getMarginBonus(5, 30, 'dutch')).toBe(eloService.CONFIG.MARGIN_BONUS.BLOWOUT);
      // 1000 vs 1060 is close in a game scored in the thousands
      expect(eloService.getMarginBonus(1060, 1000, 'flip7')).toBe(0);
    });

    it('respects lowIsBetter when deciding who won the pair', () => {
      const { alice, bob } = playTwoPlayerGame(5, 30, 'dutch', { lowIsBetter: true });
      expect(alice.placement).toBe(1);
      expect(alice.change).toBeGreaterThan(0);
      expect(bob.change).toBeLessThan(0);
    });
  });

  describe('normalizeGameType map-key safety', () => {
    it('strips characters Mongoose maps reject', () => {
      expect(eloService.normalizeGameType('Dr. Eureka')).toBe('dreureka');
      expect(eloService.normalizeGameType('$money')).toBe('money');
      expect(eloService.normalizeGameType('...')).toBe('unknown');
    });
  });

  describe('getRatableGameData', () => {
    it('unwraps nested table game data and reads document-level flags', () => {
      const game = {
        lowIsBetter: true,
        gameFinished: true,
        gameData: {
          gameData: { players: [{ id: 'p1', points: [1] }, { id: 'p2', points: [2] }] }
        }
      };
      const data = eloService.getRatableGameData(game);
      expect(data.players).toHaveLength(2);
      expect(data.lowIsBetter).toBe(true);
      expect(data.gameFinished).toBe(true);
    });

    it('keeps wizard game data as is', () => {
      const game = { gameData: { gameFinished: true, players: [{ id: 'p1' }], final_scores: { p1: 10 } } };
      const data = eloService.getRatableGameData(game);
      expect(data.final_scores).toEqual({ p1: 10 });
      expect(data.lowIsBetter).toBe(false);
    });
  });

  describe('applyEloChange', () => {
    const game = { _id: new mongoose.Types.ObjectId(), gameData: { created_at: '2026-01-02T10:00:00Z' } };
    const change = (newRating, won) => ({ newRating, change: newRating - 1000, won, placement: won ? 1 : 2, opponents: ['Bob'] });

    it('tracks rating, peak, floor, wins and streak', () => {
      const entry = eloService.getEloForGameType(createMockIdentity('x'), 'wizard');
      eloService.applyEloChange(entry, change(1016, true), game);
      eloService.applyEloChange(entry, change(1030, true), game);
      eloService.applyEloChange(entry, change(1010, false), game);

      expect(entry.rating).toBe(1010);
      expect(entry.peak).toBe(1030);
      expect(entry.floor).toBe(1000);
      expect(entry.gamesPlayed).toBe(3);
      expect(entry.wins).toBe(2);
      expect(entry.streak).toBe(-1);
      expect(entry.history[0].rating).toBe(1010);
      expect(entry.history[0].date).toEqual(new Date('2026-01-02T10:00:00Z'));
    });

    it('does not start a wrong win tally on entries from before wins were tracked', () => {
      const entry = { rating: 1100, gamesPlayed: 40, history: [] };
      eloService.applyEloChange(entry, change(1110, true), game);
      expect(entry.wins).toBeUndefined();
    });

    it('caps the history', () => {
      const entry = eloService.getEloForGameType(createMockIdentity('x'), 'wizard');
      for (let i = 0; i < eloService.CONFIG.MAX_HISTORY + 5; i++) {
        eloService.applyEloChange(entry, change(1000 + i, true), game);
      }
      expect(entry.history).toHaveLength(eloService.CONFIG.MAX_HISTORY);
      expect(entry.history[0].rating).toBe(1000 + eloService.CONFIG.MAX_HISTORY + 4);
    });
  });
});
