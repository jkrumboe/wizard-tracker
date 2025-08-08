import { describe, it, expect } from 'vitest'
import { ShareValidator } from '@/shared/utils/shareValidator'

describe('ShareValidator', () => {
  describe('Security and Validation', () => {
    describe('XSS Prevention', () => {
      it('should sanitize malicious script tags from player names', () => {
        const maliciousGameData = {
          id: 'game123',
          players: [
            { 
              id: 'player1', 
              name: '<script>alert("XSS")</script>Evil Player' 
            },
            { 
              id: 'player2', 
              name: 'Normal Player' 
            }
          ],
          total_rounds: 5,
          round_data: [],
          created_at: new Date().toISOString(),
          game_mode: 'Local'
        }

        const validation = ShareValidator.validateGameDataStructure(maliciousGameData)
        expect(validation.isValid).toBe(true)

        const sanitized = ShareValidator.sanitizeGameData(maliciousGameData)
        expect(sanitized.players[0].name).not.toContain('<script>')
        expect(sanitized.players[0].name).not.toContain('alert')
        expect(sanitized.players[0].name).toContain('Evil Player')
      })

      it('should sanitize HTML entities and dangerous content', () => {
        const maliciousData = {
          id: 'game456',
          players: [
            { 
              id: 'player1', 
              name: '&lt;img src=x onerror=alert(1)&gt;Player' 
            }
          ],
          total_rounds: 3,
          round_data: [],
          created_at: new Date().toISOString(),
          game_mode: 'Local'
        }

        const sanitized = ShareValidator.sanitizeGameData(maliciousData)
        expect(sanitized.players[0].name).not.toContain('onerror')
        expect(sanitized.players[0].name).not.toContain('alert')
      })
    })

    describe('Data Structure Validation', () => {
      it('should reject data missing required fields', () => {
        const invalidData = {
          id: 'game456',
          // Missing required 'players' field
          total_rounds: 5,
          round_data: [],
          created_at: new Date().toISOString(),
          game_mode: 'Local'
        }

        const validation = ShareValidator.validateGameDataStructure(invalidData)
        expect(validation.isValid).toBe(false)
        expect(validation.error).toContain('Missing required field: players')
      })

      it('should reject invalid data types', () => {
        const invalidData = {
          id: 'game789',
          players: [{ id: 'p1', name: 'Player 1' }],
          total_rounds: 'not a number', // Wrong type
          round_data: [],
          created_at: new Date().toISOString(),
          game_mode: 'Local'
        }

        const validation = ShareValidator.validateGameDataStructure(invalidData)
        expect(validation.isValid).toBe(false)
        expect(validation.error).toContain('Invalid total rounds')
      })

      it('should reject invalid game modes', () => {
        const invalidData = {
          id: 'game101',
          players: [{ id: 'p1', name: 'Player 1' }],
          total_rounds: 5,
          round_data: [],
          created_at: new Date().toISOString(),
          game_mode: 'InvalidMode' // Not in whitelist
        }

        const validation = ShareValidator.validateGameDataStructure(invalidData)
        expect(validation.isValid).toBe(false)
        expect(validation.error).toContain('Invalid game mode')
      })

      it('should validate player limits', () => {
        const tooManyPlayers = Array.from({ length: 25 }, (_, i) => ({
          id: `player${i}`,
          name: `Player ${i}`
        }))

        const invalidData = {
          id: 'game202',
          players: tooManyPlayers,
          total_rounds: 5,
          round_data: [],
          created_at: new Date().toISOString(),
          game_mode: 'Local'
        }

        const validation = ShareValidator.validateGameDataStructure(invalidData)
        expect(validation.isValid).toBe(false)
        expect(validation.error).toContain('Invalid number of players')
      })
    })

    describe('Size Limit Protection', () => {
      it('should reject oversized data', () => {
        const oversizedData = 'a'.repeat(ShareValidator.MAX_DECODED_SIZE + 1)
        const encodedOversized = btoa(oversizedData)

        const validation = ShareValidator.validateEncodedGameData(encodedOversized)
        expect(validation.isValid).toBe(false)
        expect(validation.error).toBe('Data too large')
      })

      it('should accept data within size limits', () => {
        const validGameData = {
          id: 'game303',
          players: [{ id: 'p1', name: 'Player 1' }],
          total_rounds: 5,
          round_data: [],
          created_at: new Date().toISOString(),
          game_mode: 'Local'
        }

        const encodedData = btoa(JSON.stringify(validGameData))
        const validation = ShareValidator.validateEncodedGameData(encodedData)
        expect(validation.isValid).toBe(true)
        expect(validation.data).toBeDefined()
      })
    })

    describe('Base64 Validation', () => {
      it('should reject invalid base64 format', () => {
        const invalidBase64 = 'This is not base64!@#$%'
        const validation = ShareValidator.validateEncodedGameData(invalidBase64)
        expect(validation.isValid).toBe(false)
        expect(validation.error).toBe('Invalid data format')
      })

      it('should accept valid base64', () => {
        const validData = { test: 'data' }
        const validBase64 = btoa(JSON.stringify(validData))
        
        // This will fail validation due to missing required fields, but base64 should be valid
        const validation = ShareValidator.validateEncodedGameData(validBase64)
        expect(validation.error).not.toBe('Invalid data format')
      })
    })

    describe('Numeric Value Clamping', () => {
      it('should clamp extreme score values', () => {
        const gameWithExtremeValues = {
          id: 'game404',
          players: [{ id: 'p1', name: 'Player 1' }],
          total_rounds: 999999, // Exceeds MAX_ROUNDS
          round_data: [],
          final_scores: {
            p1: 999999999 // Exceeds MAX_SCORE
          },
          created_at: new Date().toISOString(),
          game_mode: 'Local'
        }

        const validation = ShareValidator.validateGameDataStructure(gameWithExtremeValues)
        expect(validation.isValid).toBe(true)

        const sanitized = ShareValidator.sanitizeGameData(gameWithExtremeValues)
        expect(sanitized.total_rounds).toBeLessThanOrEqual(ShareValidator.MAX_ROUNDS)
        expect(sanitized.final_scores.p1).toBeLessThanOrEqual(ShareValidator.MAX_SCORE)
      })

      it('should handle negative scores correctly', () => {
        const gameWithNegativeScores = {
          id: 'game505',
          players: [{ id: 'p1', name: 'Player 1' }],
          total_rounds: 5,
          round_data: [],
          final_scores: {
            p1: -2000000 // Very negative score
          },
          created_at: new Date().toISOString(),
          game_mode: 'Local'
        }

        const sanitized = ShareValidator.sanitizeGameData(gameWithNegativeScores)
        expect(sanitized.final_scores.p1).toBeGreaterThanOrEqual(-ShareValidator.MAX_SCORE)
      })
    })

    describe('Property Injection Prevention', () => {
      it('should remove dangerous object properties', () => {
        const maliciousGameObject = {
          id: 'game606',
          players: [{ id: 'p1', name: 'Player 1' }],
          total_rounds: 5,
          round_data: [],
          created_at: new Date().toISOString(),
          game_mode: 'Local',
          constructor: 'malicious',
          __proto__: { evil: true },
          prototype: { hack: true }
        }

        const sanitized = ShareValidator.sanitizeGameObject(maliciousGameObject)
        expect(sanitized).not.toHaveProperty('constructor')
        expect(sanitized).not.toHaveProperty('__proto__')
        expect(sanitized).not.toHaveProperty('prototype')
        expect(sanitized.id).toBe('game606')
      })
    })

    describe('Share Key Validation', () => {
      it('should validate correct share key format', () => {
        const validShareKey = 'share_1234567890123_abcdefghi'
        expect(ShareValidator.isValidShareKey(validShareKey)).toBe(true)
      })

      it('should reject invalid share key formats', () => {
        const invalidKeys = [
          'malicious_key_format',
          'share_123_short',
          'notshare_1234567890123_abcdefghi',
          'share_123456789012a_abcdefghi', // non-numeric timestamp
          ''
        ]

        invalidKeys.forEach(key => {
          expect(ShareValidator.isValidShareKey(key)).toBe(false)
        })
      })
    })

    describe('Bulk Games Validation', () => {
      it('should validate multiple games data', () => {
        const gamesData = {
          game1: {
            id: 'game1',
            gameState: {
              id: 'game1',
              players: [{ id: 'p1', name: 'Player 1' }],
              total_rounds: 5,
              round_data: [],
              created_at: new Date().toISOString(),
              game_mode: 'Local'
            }
          },
          game2: {
            id: 'game2',
            gameState: {
              id: 'game2',
              players: [{ id: 'p1', name: 'Player 1' }],
              total_rounds: 3,
              round_data: [],
              created_at: new Date().toISOString(),
              game_mode: 'Local'
            }
          }
        }

        const encodedData = btoa(JSON.stringify(gamesData))
        const validation = ShareValidator.validateEncodedGamesData(encodedData)
        expect(validation.isValid).toBe(true)
        expect(validation.data).toBeDefined()
        expect(Object.keys(validation.data)).toHaveLength(2)
      })

      it('should reject too many games', () => {
        const manyGames = {}
        for (let i = 0; i < 105; i++) {
          manyGames[`game${i}`] = {
            id: `game${i}`,
            gameState: {
              id: `game${i}`,
              players: [{ id: 'p1', name: 'Player 1' }],
              total_rounds: 5,
              round_data: [],
              created_at: new Date().toISOString(),
              game_mode: 'Local'
            }
          }
        }

        const encodedData = btoa(JSON.stringify(manyGames))
        const validation = ShareValidator.validateEncodedGamesData(encodedData)
        expect(validation.isValid).toBe(false)
        expect(validation.error).toBe('Too many games')
      })
    })
  })

  describe('String Sanitization', () => {
    it('should remove HTML tags', () => {
      const dirtyString = '<div>Hello <span>World</span></div>'
      const clean = ShareValidator.sanitizeString(dirtyString, 100)
      expect(clean).toBe('Hello World')
    })

    it('should respect max length', () => {
      const longString = 'a'.repeat(200)
      const clean = ShareValidator.sanitizeString(longString, 50)
      expect(clean).toHaveLength(50)
    })

    it('should handle URLs correctly', () => {
      const urlString = 'Visit https://example.com for more info'
      const clean = ShareValidator.sanitizeString(urlString, 100)
      expect(clean).toContain('https://example.com')
    })
  })

  describe('Base64 Utilities', () => {
    it('should correctly identify valid base64', () => {
      const validBase64 = btoa('Hello World')
      expect(ShareValidator.isValidBase64(validBase64)).toBe(true)
    })

    it('should reject invalid base64', () => {
      const invalidBase64s = [
        'Invalid!Base64',
        '123',
        '',
        'SGVsbG8gV29ybGQ!', // Invalid character
      ]

      invalidBase64s.forEach(invalid => {
        expect(ShareValidator.isValidBase64(invalid)).toBe(false)
      })
    })
  })
})
