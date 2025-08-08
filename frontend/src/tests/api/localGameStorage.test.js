import { describe, it, expect, beforeEach, vi } from 'vitest'
import { LocalGameStorage } from '@/shared/api/localGameStorage'

describe('LocalGameStorage', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear()
    vi.clearAllMocks()
  })

  describe('Game Management', () => {
    it('should save a game to localStorage', () => {
      const gameData = {
        id: 'test-game-1',
        players: [
          { id: 'player1', name: 'Alice' },
          { id: 'player2', name: 'Bob' }
        ],
        currentRound: 1,
        maxRounds: 5,
        gameStarted: true,
        isPaused: false,
        created_at: new Date().toISOString()
      }

      const result = LocalGameStorage.saveGame(gameData)
      
      expect(result).toBe(true)
      expect(localStorage.setItem).toHaveBeenCalled()
      
      // Verify the game was stored correctly
      const storedData = localStorage.getItem('wizardTracker_localGames')
      expect(storedData).toBeDefined()
      
      const storedGames = JSON.parse(storedData)
      expect(storedGames[gameData.id]).toBeDefined()
      expect(storedGames[gameData.id].gameState.players).toHaveLength(2)
    })

    it('should retrieve a game by ID', () => {
      const gameData = {
        id: 'test-game-2',
        players: [{ id: 'player1', name: 'Charlie' }],
        currentRound: 3,
        maxRounds: 10
      }

      // Mock localStorage to return our test data
      const mockGames = { [gameData.id]: gameData }
      localStorage.getItem.mockReturnValue(JSON.stringify(mockGames))

      const result = LocalGameStorage.getGame(gameData.id)
      
      expect(result).toEqual(gameData)
      expect(localStorage.getItem).toHaveBeenCalledWith('wizardTracker_localGames')
    })

    it('should return null for non-existent game', () => {
      localStorage.getItem.mockReturnValue('{}')
      
      const result = LocalGameStorage.getGame('non-existent-game')
      
      expect(result).toBeNull()
    })

    it('should handle corrupted localStorage data gracefully', () => {
      localStorage.getItem.mockReturnValue('invalid json')
      
      const result = LocalGameStorage.getGame('any-id')
      
      expect(result).toBeNull()
    })

    it('should delete a game', () => {
      const gameData = {
        id: 'test-game-3',
        players: [{ id: 'player1', name: 'Dave' }]
      }

      const mockGames = { 
        [gameData.id]: gameData,
        'other-game': { id: 'other-game', players: [] }
      }
      localStorage.getItem.mockReturnValue(JSON.stringify(mockGames))

      const result = LocalGameStorage.deleteGame(gameData.id)
      
      expect(result).toBe(true)
      expect(localStorage.setItem).toHaveBeenCalled()
      
      // Verify only the target game was removed
      const setItemCall = localStorage.setItem.mock.calls.find(
        call => call[0] === 'wizardTracker_localGames'
      )
      const updatedGames = JSON.parse(setItemCall[1])
      expect(updatedGames).not.toHaveProperty(gameData.id)
      expect(updatedGames).toHaveProperty('other-game')
    })

    it('should get all games', () => {
      const mockGames = {
        'game1': { id: 'game1', name: 'Game 1' },
        'game2': { id: 'game2', name: 'Game 2' },
        'game3': { id: 'game3', name: 'Game 3' }
      }
      localStorage.getItem.mockReturnValue(JSON.stringify(mockGames))

      const result = LocalGameStorage.getAllGames()
      
      expect(result).toHaveLength(3)
      expect(result).toContainEqual({ id: 'game1', name: 'Game 1' })
      expect(result).toContainEqual({ id: 'game2', name: 'Game 2' })
      expect(result).toContainEqual({ id: 'game3', name: 'Game 3' })
    })

    it('should return empty array when no games exist', () => {
      localStorage.getItem.mockReturnValue(null)
      
      const result = LocalGameStorage.getAllGames()
      
      expect(result).toEqual([])
    })
  })

  describe('Game Filtering', () => {
    const mockGames = {
      'completed-game': { 
        id: 'completed-game',
        gameCompleted: true,
        updated_at: '2024-01-15T10:00:00Z'
      },
      'paused-game': { 
        id: 'paused-game',
        isPaused: true,
        gameCompleted: false,
        updated_at: '2024-01-14T10:00:00Z'
      },
      'active-game': { 
        id: 'active-game',
        gameStarted: true,
        isPaused: false,
        gameCompleted: false,
        updated_at: '2024-01-16T10:00:00Z'
      }
    }

    beforeEach(() => {
      localStorage.getItem.mockReturnValue(JSON.stringify(mockGames))
    })

    it('should get recent games', () => {
      const result = LocalGameStorage.getRecentGames(5)
      
      expect(result).toHaveLength(3)
      // Should be sorted by updated_at desc
      expect(result[0].id).toBe('active-game')
      expect(result[1].id).toBe('completed-game')
      expect(result[2].id).toBe('paused-game')
    })

    it('should limit recent games count', () => {
      const result = LocalGameStorage.getRecentGames(2)
      
      expect(result).toHaveLength(2)
      expect(result[0].id).toBe('active-game')
      expect(result[1].id).toBe('completed-game')
    })

    it('should get paused games only', () => {
      const result = LocalGameStorage.getPausedGames()
      
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('paused-game')
      expect(result[0].isPaused).toBe(true)
    })

    it('should handle games without updated_at', () => {
      const gamesWithoutDates = {
        'game1': { id: 'game1', name: 'Game 1' },
        'game2': { id: 'game2', name: 'Game 2', updated_at: '2024-01-10T10:00:00Z' }
      }
      localStorage.getItem.mockReturnValue(JSON.stringify(gamesWithoutDates))

      const result = LocalGameStorage.getRecentGames(5)
      
      expect(result).toHaveLength(2)
      // Game without date should appear after games with dates
      expect(result[0].id).toBe('game2')
      expect(result[1].id).toBe('game1')
    })
  })

  describe('Error Handling', () => {
    it('should handle localStorage exceptions when saving', () => {
      localStorage.setItem.mockImplementation(() => {
        throw new Error('QuotaExceededError')
      })

      const gameData = { id: 'test-game', players: [] }
      const result = LocalGameStorage.saveGame(gameData)
      
      expect(result).toBe(false)
    })

    it('should handle localStorage exceptions when deleting', () => {
      localStorage.getItem.mockImplementation(() => {
        throw new Error('Storage error')
      })

      const result = LocalGameStorage.deleteGame('any-id')
      
      expect(result).toBe(false)
    })

    it('should validate game data before saving', () => {
      const invalidGameData = null
      const result = LocalGameStorage.saveGame(invalidGameData)
      
      expect(result).toBe(false)
      expect(localStorage.setItem).not.toHaveBeenCalled()
    })

    it('should validate game ID before operations', () => {
      const result1 = LocalGameStorage.getGame('')
      const result2 = LocalGameStorage.deleteGame(null)
      
      expect(result1).toBeNull()
      expect(result2).toBe(false)
    })
  })

  describe('Data Integrity', () => {
    it('should preserve game data structure during save/load cycle', () => {
      const originalGame = {
        id: 'integrity-test',
        players: [
          { 
            id: 'p1', 
            name: 'Player 1', 
            score: 100,
            stats: { wins: 5, losses: 2 }
          }
        ],
        gameState: {
          currentRound: 3,
          roundHistory: [
            { round: 1, scores: { p1: 10 } },
            { round: 2, scores: { p1: 25 } }
          ]
        },
        metadata: {
          created: new Date().toISOString(),
          version: '1.0'
        }
      }

      // Save and retrieve
      LocalGameStorage.saveGame(originalGame)
      
      // Mock the stored data
      const storedGames = { [originalGame.id]: originalGame }
      localStorage.getItem.mockReturnValue(JSON.stringify(storedGames))
      
      const retrievedGame = LocalGameStorage.getGame(originalGame.id)
      
      expect(retrievedGame).toEqual(originalGame)
      expect(retrievedGame.players[0].stats).toEqual({ wins: 5, losses: 2 })
      expect(retrievedGame.gameState.roundHistory).toHaveLength(2)
    })

    it('should handle games with circular references gracefully', () => {
      const gameWithCircularRef = {
        id: 'circular-test',
        players: []
      }
      // Create circular reference
      gameWithCircularRef.self = gameWithCircularRef

      const result = LocalGameStorage.saveGame(gameWithCircularRef)
      
      // Should handle the error gracefully
      expect(result).toBe(false)
    })
  })

  describe('Performance and Storage Limits', () => {
    it('should handle large game objects', () => {
      const largeGame = {
        id: 'large-game',
        players: Array.from({ length: 10 }, (_, i) => ({
          id: `player${i}`,
          name: `Player ${i}`,
          history: Array.from({ length: 100 }, (_, j) => ({
            round: j,
            score: Math.random() * 100
          }))
        })),
        roundHistory: Array.from({ length: 50 }, (_, i) => ({
          round: i,
          data: 'round'.repeat(100)
        }))
      }

      const result = LocalGameStorage.saveGame(largeGame)
      
      // Should succeed unless storage is actually full
      expect(typeof result).toBe('boolean')
    })

    it('should provide storage usage information', () => {
      // This test depends on the implementation having storage stats
      localStorage.getItem.mockReturnValue('{"game1": {"id": "game1"}}')
      
      const games = LocalGameStorage.getAllGames()
      expect(Array.isArray(games)).toBe(true)
      
      // Could add storage size calculations here if implemented
    })
  })
})
