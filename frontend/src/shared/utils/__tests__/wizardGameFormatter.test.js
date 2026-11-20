import { formatWizardGameForBackend, repairWinnerIds, validateGameForUpload } from '../wizardGameFormatter';

describe('Wizard Game Formatter', () => {
  
  describe('formatWizardGameForBackend', () => {
    
    it('should format a complete game with all fields', () => {
      const gameData = {
        gameState: {
          players: [
            { id: 'p1', name: 'Player 1', isDealer: true, isCaller: false },
            { id: 'p2', name: 'Player 2', isDealer: false, isCaller: false }
          ],
          roundData: [
            {
              players: [
                { id: 'p1', call: 1, made: 1, score: 30 },
                { id: 'p2', call: 0, made: 0, score: 20 }
              ]
            },
            {
              players: [
                { id: 'p1', call: 2, made: 2, score: 40 },
                { id: 'p2', call: 0, made: 1, score: -10 }
              ]
            }
          ],
          maxRounds: 10,
          created_at: '2025-12-10T16:37:51.059Z',
          duration_seconds: 1200,
          winner_id: ['p1'],
          final_scores: { p1: 70, p2: 10 }
        }
      };
      
      const result = formatWizardGameForBackend(gameData);
      
      expect(result).toEqual({
        version: '3.0',
        created_at: '2025-12-10T16:37:51.059Z',
        duration_seconds: 1200,
        total_rounds: 10,
        players: [
          { id: 'p1', name: 'Player 1', isDealer: true, isCaller: false },
          { id: 'p2', name: 'Player 2', isDealer: false, isCaller: false }
        ],
        round_data: [
          {
            players: [
              { id: 'p1', call: 1, made: 1, score: 30 },
              { id: 'p2', call: 0, made: 0, score: 20 }
            ]
          },
          {
            players: [
              { id: 'p1', call: 2, made: 2, score: 40 },
              { id: 'p2', call: 0, made: 1, score: -10 }
            ]
          }
        ],
        winner_id: ['p1'],
        final_scores: { p1: 70, p2: 10 }
      });
    });
    
    it('should handle game data without gameState wrapper', () => {
      const gameData = {
        players: [
          { id: 'p1', name: 'Player 1' },
          { id: 'p2', name: 'Player 2' }
        ],
        roundData: [
          {
            players: [
              { id: 'p1', call: 1, made: 1, score: 30 },
              { id: 'p2', call: 0, made: 0, score: 20 }
            ]
          }
        ],
        maxRounds: 5,
        created_at: '2025-12-10T16:37:51.059Z'
      };
      
      const result = formatWizardGameForBackend(gameData);
      
      expect(result.players).toHaveLength(2);
      expect(result.round_data).toHaveLength(1);
      expect(result.total_rounds).toBe(5);
    });
    
    it('should convert string winner_id to array', () => {
      const gameData = {
        players: [
          { id: 'p1', name: 'Player 1' },
          { id: 'p2', name: 'Player 2' }
        ],
        roundData: [
          {
            players: [
              { id: 'p1', made: 1, score: 30 },
              { id: 'p2', made: 0, score: 20 }
            ]
          }
        ],
        winner_id: 'p1',
        created_at: '2025-12-10T16:37:51.059Z'
      };
      
      const result = formatWizardGameForBackend(gameData);
      
      expect(result.winner_id).toEqual(['p1']);
    });
    
    it('should omit call field if undefined', () => {
      const gameData = {
        players: [
          { id: 'p1', name: 'Player 1' }
        ],
        roundData: [
          {
            players: [
              { id: 'p1', made: 1, score: 30 }
            ]
          }
        ],
        created_at: '2025-12-10T16:37:51.059Z'
      };
      
      const result = formatWizardGameForBackend(gameData);
      
      expect(result.round_data[0].players[0]).not.toHaveProperty('call');
      expect(result.round_data[0].players[0]).toHaveProperty('made');
      expect(result.round_data[0].players[0]).toHaveProperty('score');
    });
    
    it('should calculate duration from timestamps if not provided', () => {
      const gameData = {
        players: [
          { id: 'p1', name: 'Player 1' }
        ],
        roundData: [
          {
            players: [
              { id: 'p1', made: 1, score: 30 }
            ]
          }
        ],
        created_at: '2025-12-10T16:37:51.059Z',
        finished_at: '2025-12-10T17:57:51.059Z'
      };
      
      const result = formatWizardGameForBackend(gameData);
      
      expect(result.duration_seconds).toBe(4800); // 80 minutes = 4800 seconds
    });
    
    it('should default to current timestamp if created_at is missing', () => {
      const beforeTime = new Date().toISOString();
      
      const gameData = {
        players: [
          { id: 'p1', name: 'Player 1' }
        ],
        roundData: [
          {
            players: [
              { id: 'p1', made: 1, score: 30 }
            ]
          }
        ]
      };
      
      const result = formatWizardGameForBackend(gameData);
      const afterTime = new Date().toISOString();
      
      expect(result.created_at).toBeDefined();
      expect(result.created_at >= beforeTime).toBe(true);
      expect(result.created_at <= afterTime).toBe(true);
    });
    
    it('should use round_data length as total_rounds if not specified', () => {
      const gameData = {
        players: [
          { id: 'p1', name: 'Player 1' }
        ],
        roundData: [
          { players: [{ id: 'p1', made: 1, score: 30 }] },
          { players: [{ id: 'p1', made: 0, score: 20 }] },
          { players: [{ id: 'p1', made: 2, score: 40 }] }
        ],
        created_at: '2025-12-10T16:37:51.059Z'
      };
      
      const result = formatWizardGameForBackend(gameData);
      
      expect(result.total_rounds).toBe(3);
    });
    
  });
  
  describe('validateGameForUpload', () => {
    
    it('should validate a game with sufficient data', () => {
      const gameData = {
        players: [
          { id: 'p1', name: 'Player 1' },
          { id: 'p2', name: 'Player 2' }
        ],
        roundData: [
          {
            players: [
              { id: 'p1', made: 1, score: 30 },
              { id: 'p2', made: 0, score: 20 }
            ]
          }
        ]
      };
      
      const result = validateGameForUpload(gameData);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should reject game with less than 2 players', () => {
      const gameData = {
        players: [
          { id: 'p1', name: 'Player 1' }
        ],
        roundData: [
          {
            players: [
              { id: 'p1', made: 1, score: 30 }
            ]
          }
        ]
      };
      
      const result = validateGameForUpload(gameData);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('At least 2 players required');
    });
    
    it('should reject game with no rounds', () => {
      const gameData = {
        players: [
          { id: 'p1', name: 'Player 1' },
          { id: 'p2', name: 'Player 2' }
        ],
        roundData: []
      };
      
      const result = validateGameForUpload(gameData);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('At least one round of data required');
    });
    
    it('should reject players missing id', () => {
      const gameData = {
        players: [
          { name: 'Player 1' },
          { id: 'p2', name: 'Player 2' }
        ],
        roundData: [
          {
            players: [
              { id: 'p1', made: 1, score: 30 },
              { id: 'p2', made: 0, score: 20 }
            ]
          }
        ]
      };
      
      const result = validateGameForUpload(gameData);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('missing id'))).toBe(true);
    });
    
    it('should reject players missing name', () => {
      const gameData = {
        players: [
          { id: 'p1', name: 'Player 1' },
          { id: 'p2' }
        ],
        roundData: [
          {
            players: [
              { id: 'p1', made: 1, score: 30 },
              { id: 'p2', made: 0, score: 20 }
            ]
          }
        ]
      };
      
      const result = validateGameForUpload(gameData);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('missing or empty name'))).toBe(true);
    });
    
    it('should reject round missing made value', () => {
      const gameData = {
        players: [
          { id: 'p1', name: 'Player 1' },
          { id: 'p2', name: 'Player 2' }
        ],
        roundData: [
          {
            players: [
              { id: 'p1', score: 30 },
              { id: 'p2', made: 0, score: 20 }
            ]
          }
        ]
      };
      
      const result = validateGameForUpload(gameData);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes("missing 'made' value"))).toBe(true);
    });
    
    it('should reject round missing score value', () => {
      const gameData = {
        players: [
          { id: 'p1', name: 'Player 1' },
          { id: 'p2', name: 'Player 2' }
        ],
        roundData: [
          {
            players: [
              { id: 'p1', made: 1 },
              { id: 'p2', made: 0, score: 20 }
            ]
          }
        ]
      };
      
      const result = validateGameForUpload(gameData);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes("missing 'score' value"))).toBe(true);
    });
    
  });
  

  describe('repairWinnerIds', () => {
    const base = {
      version: '3.0',
      players: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }],
      final_scores: { a: 40, b: 70, c: 70 },
    };

    it('returns the same object when winners match players', () => {
      const game = { ...base, winner_id: ['b', 'c'] };
      expect(repairWinnerIds(game)).toBe(game);
    });

    it('recomputes stale winners from final scores, keeping ties', () => {
      const game = { ...base, winner_id: ['1766599013192171'], winner_ids: ['1766599013192171'] };
      const repaired = repairWinnerIds(game);
      expect(repaired.winner_id).toEqual(['b', 'c']);
      expect(repaired.winner_ids).toEqual(['b', 'c']);
      expect(game.winner_id).toEqual(['1766599013192171']);
      expect(validateGameForUpload({ ...repaired, round_data: [] }).errors.join()).not.toMatch(/winner_id/);
    });

    it('drops unknown ids when scores are incomplete', () => {
      const game = { ...base, final_scores: { a: 1 }, winner_id: ['a', 'stale'] };
      expect(repairWinnerIds(game).winner_id).toEqual(['a']);
    });

    it('accepts a single string winner id', () => {
      expect(repairWinnerIds({ ...base, winner_id: 'stale' }).winner_id).toEqual(['b', 'c']);
    });
  });

});
