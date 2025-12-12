/**
 * Integration test demonstrating complete migration workflow
 * Tests actual format examples from format1.json, format2.json, and test.json
 */

const {
  detectGameFormat,
  migrateWizardGame,
  validateMigratedGame
} = require('../utils/wizardGameMigration');
const { validateWizardGameData } = require('../schemas/wizardGameSchema');

// Actual sample from format1.json (simplified)
const realFormat1 = {
  _id: '6931b79aef5ebfd540fe9050',
  userId: '68b6434852044fa6096ee4cf',
  localId: 'game_1764334403018_gny2rmj2x',
  gameData: {
    id: 'game_1764334403018_gny2rmj2x',
    name: 'Game 7.11.2025',
    gameState: {
      id: '1762551956660',
      created_at: '2025-11-07T21:45:56.860Z',
      player_ids: [
        '690dbbd38b2c1830b8503e49',
        '1762545697621706',
        '1762545702992498',
        '1762545707094840'
      ],
      players: [
        { id: '690dbbd38b2c1830b8503e49', name: 'Humam', isVerified: true },
        { id: '1762545697621706', name: 'Lukas', isVerified: false },
        { id: '1762545702992498', name: 'Tobi', isVerified: false },
        { id: '1762545707094840', name: 'Robin', isVerified: false }
      ],
      winner_id: '1762545687412396',
      final_scores: {
        '690dbbd38b2c1830b8503e49': 90,
        '1762545697621706': 10,
        '1762545702992498': 40,
        '1762545707094840': 120
      },
      round_data: [
        {
          round: 1,
          cards: 1,
          players: [
            { id: '690dbbd38b2c1830b8503e49', name: 'Humam', call: 1, made: 1, score: 30, totalScore: 30 },
            { id: '1762545697621706', name: 'Lukas', call: 0, made: 0, score: 20, totalScore: 20 },
            { id: '1762545702992498', name: 'Tobi', call: 1, made: 0, score: -10, totalScore: -10 },
            { id: '1762545707094840', name: 'Robin', call: 0, made: 0, score: 20, totalScore: 20 }
          ]
        },
        {
          round: 2,
          cards: 2,
          players: [
            { id: '690dbbd38b2c1830b8503e49', name: 'Humam', call: 1, made: 1, score: 30, totalScore: 60 },
            { id: '1762545697621706', name: 'Lukas', call: 1, made: 1, score: 30, totalScore: 50 },
            { id: '1762545702992498', name: 'Tobi', call: 0, made: 0, score: 20, totalScore: 10 },
            { id: '1762545707094840', name: 'Robin', call: 0, made: 0, score: 20, totalScore: 40 }
          ]
        }
      ],
      duration_seconds: 6181,
      game_mode: 'Local',
      total_rounds: 8,
      is_local: true
    }
  }
};

// Actual sample from format2.json (simplified)
const realFormat2 = {
  _id: '6914a57150e7f666262ff148',
  userId: '68b6434852044fa6096ee4cf',
  localId: 'game_1762950372752_q3sk1g1rz',
  gameData: {
    id: '1762960753602',
    created_at: '2025-11-12T15:19:13.602Z',
    player_ids: [
      '68f90d2ebfdde711a68b980b',
      '68b6434852044fa6096ee4cf',
      '690dbbd38b2c1830b8503e49'
    ],
    players: [
      { id: '68f90d2ebfdde711a68b980b', name: 'jakob', isVerified: true },
      { id: '68b6434852044fa6096ee4cf', name: 'Justin', isVerified: true },
      { id: '690dbbd38b2c1830b8503e49', name: 'Humam', isVerified: true }
    ],
    winner_id: '68b6434852044fa6096ee4cf',
    final_scores: {
      '68f90d2ebfdde711a68b980b': 240,
      '68b6434852044fa6096ee4cf': 360,
      '690dbbd38b2c1830b8503e49': 340
    },
    round_data: [
      {
        round: 1,
        cards: 1,
        players: [
          { id: '68f90d2ebfdde711a68b980b', name: 'jakob', call: 1, made: 0, score: -10, totalScore: -10 },
          { id: '68b6434852044fa6096ee4cf', name: 'Justin', call: 0, made: 0, score: 20, totalScore: 20 },
          { id: '690dbbd38b2c1830b8503e49', name: 'Humam', call: 0, made: 0, score: 20, totalScore: 20 }
        ]
      },
      {
        round: 2,
        cards: 2,
        players: [
          { id: '68f90d2ebfdde711a68b980b', name: 'jakob', call: 0, made: 0, score: 20, totalScore: 10 },
          { id: '68b6434852044fa6096ee4cf', name: 'Justin', call: 1, made: 1, score: 30, totalScore: 50 },
          { id: '690dbbd38b2c1830b8503e49', name: 'Humam', call: 1, made: 1, score: 30, totalScore: 50 }
        ]
      }
    ],
    duration_seconds: 10380,
    game_mode: 'Local',
    total_rounds: 15,
    is_local: true
  }
};

// Actual sample from test.json (simplified) - v3.0 format
const realFormat3 = {
  id: 'game_1765366835590_so12hsqnj',
  userId: '68b6434852044fa6096ee4cf',
  gameData: {
    created_at: '2025-12-10T16:37:51.059Z',
    duration_seconds: 17835,
    total_rounds: 17,
    players: [
      { id: '6935c8eb16d6aab46cdcd818', name: 'RobinRummels', isDealer: true, isCaller: false },
      { id: '69395b3e741c00d8598496ae', name: 'Jakob-Jägermeister', isDealer: false, isCaller: false },
      { id: '690dbbd38b2c1830b8503e49', name: 'Humam', isDealer: false, isCaller: false }
    ],
    winner_id: [
      '69395b3e741c00d8598496ae',
      '68b6434852044fa6096ee4cf'
    ],
    final_scores: {
      '6935c8eb16d6aab46cdcd818': 250,
      '69395b3e741c00d8598496ae': 320,
      '690dbbd38b2c1830b8503e49': 270
    },
    round_data: [
      {
        players: [
          { id: '6935c8eb16d6aab46cdcd818', call: 0, made: 0, score: 20 },
          { id: '69395b3e741c00d8598496ae', call: 0, made: 0, score: 20 },
          { id: '690dbbd38b2c1830b8503e49', call: 0, made: 1, score: -10 }
        ]
      },
      {
        players: [
          { id: '6935c8eb16d6aab46cdcd818', call: 0, made: 0, score: 20 },
          { id: '69395b3e741c00d8598496ae', call: 2, made: 2, score: 40 },
          { id: '690dbbd38b2c1830b8503e49', call: 1, made: 0, score: -10 }
        ]
      }
    ]
  }
};

describe('Real-World Migration Workflow', () => {
  describe('Format 1.0 (Nested gameState)', () => {
    test('should detect format1.json as v1.0', () => {
      const version = detectGameFormat(realFormat1.gameData);
      expect(version).toBe('1.0');
    });

    test('should migrate format1.json to valid v3.0', () => {
      const { migrated, originalVersion, needsMigration } = migrateWizardGame(realFormat1.gameData);
      
      expect(originalVersion).toBe('1.0');
      expect(needsMigration).toBe(true);
      expect(migrated.version).toBe('3.0');
      
      // Verify structure
      expect(migrated.players).toHaveLength(4);
      expect(migrated.round_data).toHaveLength(2);
      
      // Verify v1.0 fields removed
      expect(migrated.players[0].isVerified).toBeUndefined();
      expect(migrated.round_data[0].round).toBeUndefined();
      expect(migrated.round_data[0].cards).toBeUndefined();
      expect(migrated.round_data[0].players[0].totalScore).toBeUndefined();
      expect(migrated.round_data[0].players[0].name).toBeUndefined();
      
      // Verify v3.0 fields added
      expect(migrated.players[0].isDealer).toBeDefined();
      expect(migrated.players[0].isCaller).toBeDefined();
    });

    test('should pass migration validation for format1.json', () => {
      const { migrated } = migrateWizardGame(realFormat1.gameData);
      const validation = validateMigratedGame(migrated);
      
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('should pass schema validation for migrated format1.json', () => {
      const { migrated } = migrateWizardGame(realFormat1.gameData);
      const validation = validateWizardGameData(migrated);
      
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });
  });

  describe('Format 2.0 (Flat with player_ids)', () => {
    test('should detect format2.json as v2.0', () => {
      const version = detectGameFormat(realFormat2.gameData);
      expect(version).toBe('2.0');
    });

    test('should migrate format2.json to valid v3.0', () => {
      const { migrated, originalVersion, needsMigration } = migrateWizardGame(realFormat2.gameData);
      
      expect(originalVersion).toBe('2.0');
      expect(needsMigration).toBe(true);
      expect(migrated.version).toBe('3.0');
      
      // Verify structure
      expect(migrated.players).toHaveLength(3);
      expect(migrated.round_data).toHaveLength(2);
      
      // Verify v2.0 fields removed
      expect(migrated.players[0].isVerified).toBeUndefined();
      expect(migrated.round_data[0].round).toBeUndefined();
      expect(migrated.round_data[0].cards).toBeUndefined();
      expect(migrated.round_data[0].players[0].totalScore).toBeUndefined();
      expect(migrated.round_data[0].players[0].name).toBeUndefined();
      
      // Verify v3.0 fields added
      expect(migrated.players[0].isDealer).toBeDefined();
      expect(migrated.players[0].isCaller).toBeDefined();
    });

    test('should pass migration validation for format2.json', () => {
      const { migrated } = migrateWizardGame(realFormat2.gameData);
      const validation = validateMigratedGame(migrated);
      
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('should pass schema validation for migrated format2.json', () => {
      const { migrated } = migrateWizardGame(realFormat2.gameData);
      const validation = validateWizardGameData(migrated);
      
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });
  });

  describe('Format 3.0 (Current clean format)', () => {
    test('should detect test.json as v3.0', () => {
      const version = detectGameFormat(realFormat3.gameData);
      expect(version).toBe('3.0');
    });

    test('should handle test.json without migration', () => {
      const { migrated, originalVersion, needsMigration } = migrateWizardGame(realFormat3.gameData);
      
      expect(originalVersion).toBe('3.0');
      expect(needsMigration).toBe(true); // Only to add version field
      expect(migrated.version).toBe('3.0');
      
      // Structure should be preserved
      expect(migrated.players).toHaveLength(3);
      expect(migrated.round_data).toHaveLength(2);
      expect(migrated.players[0].isDealer).toBeDefined();
      expect(migrated.round_data[0].round).toBeUndefined(); // Should not have round field
    });

    test('should add version field to test.json if missing', () => {
      const gameWithoutVersion = { ...realFormat3.gameData };
      delete gameWithoutVersion.version;
      
      const { migrated } = migrateWizardGame(gameWithoutVersion);
      
      expect(migrated.version).toBe('3.0');
    });

    test('should pass validation for test.json', () => {
      const { migrated } = migrateWizardGame(realFormat3.gameData);
      const validation = validateWizardGameData(migrated);
      
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });
  });

  describe('Complete Migration Workflow', () => {
    test('should migrate all three formats to identical v3.0 structure', () => {
      const migrated1 = migrateWizardGame(realFormat1.gameData).migrated;
      const migrated2 = migrateWizardGame(realFormat2.gameData).migrated;
      const migrated3 = migrateWizardGame(realFormat3.gameData).migrated;
      
      // All should have v3.0 structure
      expect(migrated1.version).toBe('3.0');
      expect(migrated2.version).toBe('3.0');
      expect(migrated3.version).toBe('3.0');
      
      // All should have required fields
      expect(migrated1.created_at).toBeDefined();
      expect(migrated2.created_at).toBeDefined();
      expect(migrated3.created_at).toBeDefined();
      
      // All should have players with isDealer/isCaller
      expect(migrated1.players[0].isDealer).toBeDefined();
      expect(migrated2.players[0].isDealer).toBeDefined();
      expect(migrated3.players[0].isDealer).toBeDefined();
      
      // None should have v1.0/v2.0 fields
      expect(migrated1.players[0].isVerified).toBeUndefined();
      expect(migrated2.players[0].isVerified).toBeUndefined();
      expect(migrated1.round_data[0].round).toBeUndefined();
      expect(migrated2.round_data[0].round).toBeUndefined();
    });

    test('should preserve game data integrity through migration', () => {
      // Test format1
      const migrated1 = migrateWizardGame(realFormat1.gameData).migrated;
      expect(migrated1.players).toHaveLength(4);
      expect(migrated1.duration_seconds).toBe(realFormat1.gameData.gameState.duration_seconds);
      expect(migrated1.final_scores).toEqual(realFormat1.gameData.gameState.final_scores);
      
      // Test format2
      const migrated2 = migrateWizardGame(realFormat2.gameData).migrated;
      expect(migrated2.players).toHaveLength(3);
      expect(migrated2.duration_seconds).toBe(realFormat2.gameData.duration_seconds);
      expect(migrated2.final_scores).toEqual(realFormat2.gameData.final_scores);
      
      // Test format3
      const migrated3 = migrateWizardGame(realFormat3.gameData).migrated;
      expect(migrated3.players).toHaveLength(3);
      expect(migrated3.duration_seconds).toBe(realFormat3.gameData.duration_seconds);
      expect(migrated3.final_scores).toEqual(realFormat3.gameData.final_scores);
    });

    test('should produce valid games for all formats', () => {
      const formats = [realFormat1.gameData, realFormat2.gameData, realFormat3.gameData];
      
      formats.forEach((format, idx) => {
        const { migrated } = migrateWizardGame(format);
        
        // Migration validation
        const migrationValidation = validateMigratedGame(migrated);
        expect(migrationValidation.isValid).toBe(true);
        
        // Schema validation
        const schemaValidation = validateWizardGameData(migrated);
        expect(schemaValidation.isValid).toBe(true);
      });
    });
  });
});
