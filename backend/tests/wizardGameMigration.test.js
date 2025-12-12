/**
 * Tests for Wizard Game Migration Utility
 * Tests format detection and migration from v1.0 and v2.0 to v3.0
 */

const {
  detectGameFormat,
  migrateWizardGame,
  migrateFromV1,
  migrateFromV2,
  validateMigratedGame,
  CURRENT_VERSION
} = require('../utils/wizardGameMigration');

// Sample game data from format1.json (v1.0 - nested gameState)
const format1Sample = {
  id: 'game_1764334403018_gny2rmj2x',
  gameState: {
    id: '1762551956660',
    created_at: '2025-11-07T21:45:56.860Z',
    player_ids: ['690dbbd38b2c1830b8503e49', '1762545697621706'],
    players: [
      { id: '690dbbd38b2c1830b8503e49', name: 'Humam', isVerified: true },
      { id: '1762545697621706', name: 'Lukas', isVerified: false }
    ],
    winner_id: '1762545687412396',
    final_scores: {
      '690dbbd38b2c1830b8503e49': 90,
      '1762545697621706': 10
    },
    round_data: [
      {
        round: 1,
        cards: 1,
        players: [
          { id: '690dbbd38b2c1830b8503e49', name: 'Humam', call: 0, made: 0, score: 20, totalScore: 20 },
          { id: '1762545697621706', name: 'Lukas', call: 1, made: 1, score: 30, totalScore: 30 }
        ]
      }
    ],
    duration_seconds: 6181,
    total_rounds: 8
  }
};

// Sample game data from format2.json (v2.0 - flat with player_ids)
const format2Sample = {
  id: '1762960753602',
  created_at: '2025-11-12T15:19:13.602Z',
  player_ids: ['68f90d2ebfdde711a68b980b', '68b6434852044fa6096ee4cf'],
  players: [
    { id: '68f90d2ebfdde711a68b980b', name: 'jakob', isVerified: true },
    { id: '68b6434852044fa6096ee4cf', name: 'Justin', isVerified: true }
  ],
  winner_id: '68b6434852044fa6096ee4cf',
  final_scores: {
    '68f90d2ebfdde711a68b980b': 240,
    '68b6434852044fa6096ee4cf': 360
  },
  round_data: [
    {
      round: 1,
      cards: 1,
      players: [
        { id: '68f90d2ebfdde711a68b980b', name: 'jakob', call: 1, made: 0, score: -10, totalScore: -10 },
        { id: '68b6434852044fa6096ee4cf', name: 'Justin', call: 0, made: 0, score: 20, totalScore: 20 }
      ]
    }
  ],
  duration_seconds: 10380,
  total_rounds: 15
};

// Sample game data from test.json (v3.0 - clean format)
const format3Sample = {
  version: '3.0',
  created_at: '2025-12-10T16:37:51.059Z',
  duration_seconds: 17835,
  total_rounds: 17,
  players: [
    { id: '6935c8eb16d6aab46cdcd818', name: 'RobinRummels', isDealer: true, isCaller: false },
    { id: '69395b3e741c00d8598496ae', name: 'Jakob-Jägermeister', isDealer: false, isCaller: false }
  ],
  winner_id: ['69395b3e741c00d8598496ae', '68b6434852044fa6096ee4cf'],
  final_scores: {
    '6935c8eb16d6aab46cdcd818': 250,
    '69395b3e741c00d8598496ae': 320
  },
  round_data: [
    {
      players: [
        { id: '6935c8eb16d6aab46cdcd818', call: 0, made: 0, score: 20 },
        { id: '69395b3e741c00d8598496ae', call: 0, made: 0, score: 20 }
      ]
    }
  ]
};

describe('Wizard Game Migration - Format Detection', () => {
  test('should detect format 1.0 (nested gameState)', () => {
    expect(detectGameFormat(format1Sample)).toBe('1.0');
  });

  test('should detect format 2.0 (flat with player_ids)', () => {
    expect(detectGameFormat(format2Sample)).toBe('2.0');
  });

  test('should detect format 3.0 (clean format)', () => {
    expect(detectGameFormat(format3Sample)).toBe('3.0');
  });

  test('should detect unknown format', () => {
    const unknownFormat = { some: 'data', without: 'structure' };
    expect(detectGameFormat(unknownFormat)).toBe('unknown');
  });

  test('should detect version from version field if present', () => {
    const withVersion = { version: '2.5', players: [], round_data: [] };
    expect(detectGameFormat(withVersion)).toBe('2.5');
  });
});

describe('Wizard Game Migration - From v1.0', () => {
  test('should migrate v1.0 to v3.0 format', () => {
    const migrated = migrateFromV1(format1Sample);
    
    expect(migrated.version).toBe(CURRENT_VERSION);
    expect(migrated.created_at).toBe(format1Sample.gameState.created_at);
    expect(migrated.duration_seconds).toBe(format1Sample.gameState.duration_seconds);
    expect(migrated.total_rounds).toBe(format1Sample.gameState.total_rounds);
    expect(migrated.players).toHaveLength(2);
    expect(migrated.round_data).toHaveLength(1);
  });

  test('should remove v1.0 specific fields (isVerified, totalScore, name, round, cards)', () => {
    const migrated = migrateFromV1(format1Sample);
    
    // Players should not have isVerified
    expect(migrated.players[0].isVerified).toBeUndefined();
    
    // Round data should not have round/cards numbers
    expect(migrated.round_data[0].round).toBeUndefined();
    expect(migrated.round_data[0].cards).toBeUndefined();
    
    // Player round data should not have totalScore or name
    expect(migrated.round_data[0].players[0].totalScore).toBeUndefined();
    expect(migrated.round_data[0].players[0].name).toBeUndefined();
  });

  test('should add isDealer and isCaller fields to players', () => {
    const migrated = migrateFromV1(format1Sample);
    
    expect(migrated.players[0].isDealer).toBe(true); // First player is dealer
    expect(migrated.players[0].isCaller).toBe(false);
    expect(migrated.players[1].isDealer).toBe(false);
  });

  test('should normalize winner_id to array', () => {
    const migrated = migrateFromV1(format1Sample);
    
    expect(Array.isArray(migrated.winner_id)).toBe(true);
    expect(migrated.winner_id).toContain(format1Sample.gameState.winner_id);
  });

  test('should preserve final_scores', () => {
    const migrated = migrateFromV1(format1Sample);
    
    expect(migrated.final_scores).toEqual(format1Sample.gameState.final_scores);
  });
});

describe('Wizard Game Migration - From v2.0', () => {
  test('should migrate v2.0 to v3.0 format', () => {
    const migrated = migrateFromV2(format2Sample);
    
    expect(migrated.version).toBe(CURRENT_VERSION);
    expect(migrated.created_at).toBe(format2Sample.created_at);
    expect(migrated.duration_seconds).toBe(format2Sample.duration_seconds);
    expect(migrated.total_rounds).toBe(format2Sample.total_rounds);
    expect(migrated.players).toHaveLength(2);
    expect(migrated.round_data).toHaveLength(1);
  });

  test('should remove v2.0 specific fields (isVerified, totalScore, name, round, cards)', () => {
    const migrated = migrateFromV2(format2Sample);
    
    // Players should not have isVerified
    expect(migrated.players[0].isVerified).toBeUndefined();
    
    // Round data should not have round/cards
    expect(migrated.round_data[0].round).toBeUndefined();
    expect(migrated.round_data[0].cards).toBeUndefined();
    
    // Player round data should not have totalScore or name
    expect(migrated.round_data[0].players[0].totalScore).toBeUndefined();
    expect(migrated.round_data[0].players[0].name).toBeUndefined();
  });

  test('should preserve winner_id as array if already array', () => {
    const format2WithArrayWinner = {
      ...format2Sample,
      winner_id: ['player1', 'player2']
    };
    const migrated = migrateFromV2(format2WithArrayWinner);
    
    expect(Array.isArray(migrated.winner_id)).toBe(true);
    expect(migrated.winner_id).toHaveLength(2);
  });
});

describe('Wizard Game Migration - Main Function', () => {
  test('should migrate v1.0 game', () => {
    const result = migrateWizardGame(format1Sample);
    
    expect(result.originalVersion).toBe('1.0');
    expect(result.needsMigration).toBe(true);
    expect(result.migrated.version).toBe(CURRENT_VERSION);
  });

  test('should migrate v2.0 game', () => {
    const result = migrateWizardGame(format2Sample);
    
    expect(result.originalVersion).toBe('2.0');
    expect(result.needsMigration).toBe(true);
    expect(result.migrated.version).toBe(CURRENT_VERSION);
  });

  test('should handle v3.0 game without migration', () => {
    const result = migrateWizardGame(format3Sample);
    
    expect(result.originalVersion).toBe('3.0');
    expect(result.needsMigration).toBe(false);
    expect(result.migrated.version).toBe(CURRENT_VERSION);
  });

  test('should add version field if v3.0 game missing it', () => {
    const v3WithoutVersion = { ...format3Sample };
    delete v3WithoutVersion.version;
    
    const result = migrateWizardGame(v3WithoutVersion);
    
    expect(result.originalVersion).toBe('3.0');
    expect(result.needsMigration).toBe(true); // Needs migration to add version
    expect(result.migrated.version).toBe(CURRENT_VERSION);
  });

  test('should handle unknown format gracefully', () => {
    const unknownFormat = { unknown: 'data' };
    const result = migrateWizardGame(unknownFormat);
    
    expect(result.originalVersion).toBe('unknown');
    expect(result.needsMigration).toBe(false);
    expect(result.error).toBeDefined();
  });
});

describe('Wizard Game Migration - Validation', () => {
  test('should validate successfully migrated v3.0 game', () => {
    const migrated = migrateFromV2(format2Sample);
    const validation = validateMigratedGame(migrated);
    
    expect(validation.isValid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  test('should detect missing version', () => {
    const invalid = { ...format3Sample };
    delete invalid.version;
    
    const validation = validateMigratedGame(invalid);
    
    expect(validation.isValid).toBe(false);
    expect(validation.errors).toContain(`Missing or invalid version (expected ${CURRENT_VERSION})`);
  });

  test('should detect missing required fields', () => {
    const invalid = { version: CURRENT_VERSION };
    const validation = validateMigratedGame(invalid);
    
    expect(validation.isValid).toBe(false);
    expect(validation.errors.length).toBeGreaterThan(0);
  });

  test('should detect v2.0 format remnants in round data', () => {
    const invalid = {
      version: CURRENT_VERSION,
      created_at: '2025-01-01T00:00:00.000Z',
      duration_seconds: 100,
      total_rounds: 1,
      players: [
        { id: 'p1', name: 'Player 1' },
        { id: 'p2', name: 'Player 2' }
      ],
      round_data: [
        {
          round: 1, // Should not be present in v3.0
          cards: 1, // Should not be present in v3.0
          players: [
            { id: 'p1', made: 0, score: 20 },
            { id: 'p2', made: 0, score: 20 }
          ]
        }
      ]
    };
    
    const validation = validateMigratedGame(invalid);
    
    expect(validation.isValid).toBe(false);
    expect(validation.errors.some(e => e.includes('round'))).toBe(true);
    expect(validation.errors.some(e => e.includes('cards'))).toBe(true);
  });

  test('should detect v2.0 format remnants in player round data', () => {
    const invalid = {
      version: CURRENT_VERSION,
      created_at: '2025-01-01T00:00:00.000Z',
      duration_seconds: 100,
      total_rounds: 1,
      players: [
        { id: 'p1', name: 'Player 1' },
        { id: 'p2', name: 'Player 2' }
      ],
      round_data: [
        {
          players: [
            { id: 'p1', made: 0, score: 20, totalScore: 20 }, // Should not have totalScore
            { id: 'p2', made: 0, score: 20, name: 'Player 2' } // Should not have name
          ]
        }
      ]
    };
    
    const validation = validateMigratedGame(invalid);
    
    expect(validation.isValid).toBe(false);
    expect(validation.errors.some(e => e.includes('totalScore'))).toBe(true);
    expect(validation.errors.some(e => e.includes('name'))).toBe(true);
  });
});

describe('Wizard Game Migration - Edge Cases', () => {
  test('should handle game with optional call field missing', () => {
    const gameWithoutCall = {
      ...format1Sample,
      gameState: {
        ...format1Sample.gameState,
        round_data: [
          {
            players: [
              { id: 'p1', made: 0, score: 20 }, // No call field
              { id: 'p2', made: 0, score: 20 }
            ]
          }
        ]
      }
    };
    
    const migrated = migrateFromV1(gameWithoutCall);
    
    expect(migrated.round_data[0].players[0].call).toBeUndefined();
    expect(migrated.round_data[0].players[0].made).toBe(0);
  });

  test('should calculate duration_seconds if missing but timestamps available', () => {
    const gameWithTimestamps = {
      gameState: {
        created_at: '2025-01-01T00:00:00.000Z',
        finished_at: '2025-01-01T01:00:00.000Z',
        players: [],
        round_data: [],
        total_rounds: 1
      }
    };
    
    const migrated = migrateFromV1(gameWithTimestamps);
    
    expect(migrated.duration_seconds).toBe(3600); // 1 hour = 3600 seconds
  });

  test('should handle empty final_scores', () => {
    const gameWithoutScores = {
      ...format2Sample,
      final_scores: {}
    };
    
    const migrated = migrateFromV2(gameWithoutScores);
    
    expect(migrated.final_scores).toBeUndefined();
  });

  test('should handle missing winner_id', () => {
    const gameWithoutWinner = {
      ...format2Sample
    };
    delete gameWithoutWinner.winner_id;
    
    const migrated = migrateFromV2(gameWithoutWinner);
    
    expect(migrated.winner_id).toBeUndefined();
  });
});
