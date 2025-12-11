const { validateWizardGameData, normalizeWinnerId } = require('../schemas/wizardGameSchema');

describe('Wizard Game Schema Validation', () => {
  
  const validGameData = {
    created_at: '2025-12-10T16:37:51.059Z',
    duration_seconds: 17835,
    total_rounds: 17,
    players: [
      {
        id: '6935c8eb16d6aab46cdcd818',
        name: 'RobinRummels',
        isDealer: true,
        isCaller: false
      },
      {
        id: '69395b3e741c00d8598496ae',
        name: 'Jakob-Jägermeister',
        isDealer: false,
        isCaller: false
      },
      {
        id: '690dbbd38b2c1830b8503e49',
        name: 'Humam',
        isDealer: false,
        isCaller: false
      },
      {
        id: '68b6434852044fa6096ee4cf',
        name: 'Justin',
        isDealer: false,
        isCaller: true
      }
    ],
    winner_id: ['69395b3e741c00d8598496ae', '68b6434852044fa6096ee4cf'],
    final_scores: {
      '6935c8eb16d6aab46cdcd818': 250,
      '69395b3e741c00d8598496ae': 320,
      '690dbbd38b2c1830b8503e49': 270,
      '68b6434852044fa6096ee4cf': 320
    },
    round_data: [
      {
        players: [
          {
            id: '6935c8eb16d6aab46cdcd818',
            call: 0,
            made: 0,
            score: 20
          },
          {
            id: '69395b3e741c00d8598496ae',
            call: 0,
            made: 0,
            score: 20
          },
          {
            id: '690dbbd38b2c1830b8503e49',
            call: 0,
            made: 1,
            score: -10
          },
          {
            id: '68b6434852044fa6096ee4cf',
            made: 0,
            score: 20
          }
        ]
      },
      {
        players: [
          {
            id: '6935c8eb16d6aab46cdcd818',
            call: 0,
            made: 0,
            score: 20
          },
          {
            id: '69395b3e741c00d8598496ae',
            call: 2,
            made: 2,
            score: 40
          },
          {
            id: '690dbbd38b2c1830b8503e49',
            call: 1,
            made: 0,
            score: -10
          },
          {
            id: '68b6434852044fa6096ee4cf',
            call: 0,
            made: 0,
            score: 20
          }
        ]
      }
    ]
  };

  describe('validateWizardGameData', () => {
    
    it('should validate a complete valid game', () => {
      const result = validateWizardGameData(validGameData);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should require created_at', () => {
      const invalidData = { ...validGameData };
      delete invalidData.created_at;
      const result = validateWizardGameData(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('created_at is required');
    });

    it('should require duration_seconds', () => {
      const invalidData = { ...validGameData };
      delete invalidData.duration_seconds;
      const result = validateWizardGameData(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('duration_seconds is required');
    });

    it('should require total_rounds', () => {
      const invalidData = { ...validGameData };
      delete invalidData.total_rounds;
      const result = validateWizardGameData(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('total_rounds is required');
    });

    it('should require players array', () => {
      const invalidData = { ...validGameData };
      delete invalidData.players;
      const result = validateWizardGameData(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('players array is required');
    });

    it('should require at least 2 players', () => {
      const invalidData = { ...validGameData, players: [{ id: 'p1', name: 'Player 1' }] };
      const result = validateWizardGameData(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('At least 2 players required');
    });

    it('should reject more than 6 players', () => {
      const invalidData = { 
        ...validGameData, 
        players: [
          { id: 'p1', name: 'Player 1' },
          { id: 'p2', name: 'Player 2' },
          { id: 'p3', name: 'Player 3' },
          { id: 'p4', name: 'Player 4' },
          { id: 'p5', name: 'Player 5' },
          { id: 'p6', name: 'Player 6' },
          { id: 'p7', name: 'Player 7' }
        ] 
      };
      const result = validateWizardGameData(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Maximum 6 players allowed');
    });

    it('should require player id', () => {
      const invalidData = { 
        ...validGameData, 
        players: [
          { name: 'Player 1' },
          { id: 'p2', name: 'Player 2' }
        ] 
      };
      const result = validateWizardGameData(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('id is required'))).toBe(true);
    });

    it('should require player name', () => {
      const invalidData = { 
        ...validGameData, 
        players: [
          { id: 'p1' },
          { id: 'p2', name: 'Player 2' }
        ] 
      };
      const result = validateWizardGameData(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('name is required'))).toBe(true);
    });

    it('should require round_data array', () => {
      const invalidData = { ...validGameData };
      delete invalidData.round_data;
      const result = validateWizardGameData(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('round_data array is required');
    });

    it('should validate round player data', () => {
      const invalidData = { 
        ...validGameData,
        round_data: [
          {
            players: [
              { id: 'p1' } // missing made and score
            ]
          }
        ]
      };
      const result = validateWizardGameData(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('made is required'))).toBe(true);
      expect(result.errors.some(e => e.includes('score is required'))).toBe(true);
    });

    it('should accept string winner_id', () => {
      const dataWithStringWinner = { 
        ...validGameData, 
        winner_id: '69395b3e741c00d8598496ae' 
      };
      const result = validateWizardGameData(dataWithStringWinner);
      expect(result.isValid).toBe(true);
    });

    it('should accept array winner_id', () => {
      const result = validateWizardGameData(validGameData);
      expect(result.isValid).toBe(true);
    });

    it('should reject invalid winner_id type', () => {
      const invalidData = { 
        ...validGameData, 
        winner_id: 123 
      };
      const result = validateWizardGameData(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('winner_id must be a string or array of strings');
    });

    it('should validate final_scores as object', () => {
      const invalidData = { 
        ...validGameData, 
        final_scores: "not an object" 
      };
      const result = validateWizardGameData(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('final_scores must be an object');
    });

    it('should allow missing call field in round data', () => {
      const dataWithoutCall = {
        ...validGameData,
        round_data: [
          {
            players: [
              {
                id: '6935c8eb16d6aab46cdcd818',
                made: 0,
                score: 20
              },
              {
                id: '69395b3e741c00d8598496ae',
                made: 0,
                score: 20
              }
            ]
          }
        ]
      };
      const result = validateWizardGameData(dataWithoutCall);
      expect(result.isValid).toBe(true);
    });

  });

  describe('normalizeWinnerId', () => {
    
    it('should convert string to array', () => {
      const result = normalizeWinnerId('player1');
      expect(result).toEqual(['player1']);
    });

    it('should return array as-is', () => {
      const result = normalizeWinnerId(['player1', 'player2']);
      expect(result).toEqual(['player1', 'player2']);
    });

    it('should return empty array for null/undefined', () => {
      expect(normalizeWinnerId(null)).toEqual([]);
      expect(normalizeWinnerId(undefined)).toEqual([]);
    });

  });

});
