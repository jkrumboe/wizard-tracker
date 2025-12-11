const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const Game = require('../models/Game');
const { validateWizardGameData } = require('../schemas/wizardGameSchema');

// Create a simple mock auth middleware
const mockAuth = (req, res, next) => {
  req.user = { _id: new mongoose.Types.ObjectId() };
  next();
};

// Mock the cache module
jest.mock('../utils/redis', () => ({
  isConnected: false,
  delPattern: jest.fn()
}));

describe('Wizard Game Upload Integration Test', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    // Create a test route that mimics the games route
    app.post('/api/games', mockAuth, async (req, res) => {
      try {
        const { gameData, localId } = req.body;

        // Validation
        if (!gameData || typeof gameData !== 'object') {
          return res.status(400).json({ error: 'gameData (object) is required' });
        }
        if (!localId || typeof localId !== 'string') {
          return res.status(400).json({ error: 'localId (string) is required' });
        }

        // Validate wizard game data structure
        const validation = validateWizardGameData(gameData);
        if (!validation.isValid) {
          return res.status(400).json({ 
            error: 'Invalid game data structure', 
            validationErrors: validation.errors 
          });
        }

        const userId = req.user._id;

        // Check for duplicates by localId
        const existingByLocalId = await Game.findOne({ localId });
        if (existingByLocalId) {
          return res.status(200).json({
            message: 'Game already exists (by localId)',
            duplicate: true,
            game: {
              id: existingByLocalId._id,
              userId: existingByLocalId.userId,
              gameData: existingByLocalId.gameData,
              createdAt: existingByLocalId.createdAt
            }
          });
        }

        const game = new Game({
          userId,
          localId,
          gameData
        });

        await game.save();

        res.status(201).json({
          message: 'Game created successfully',
          game: {
            id: game._id,
            userId: game.userId,
            gameData: game.gameData,
            createdAt: game.createdAt
          }
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
  });

  const validWizardGame = {
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
          { id: '6935c8eb16d6aab46cdcd818', call: 0, made: 0, score: 20 },
          { id: '69395b3e741c00d8598496ae', call: 0, made: 0, score: 20 },
          { id: '690dbbd38b2c1830b8503e49', call: 0, made: 1, score: -10 },
          { id: '68b6434852044fa6096ee4cf', made: 0, score: 20 }
        ]
      },
      {
        players: [
          { id: '6935c8eb16d6aab46cdcd818', call: 0, made: 0, score: 20 },
          { id: '69395b3e741c00d8598496ae', call: 2, made: 2, score: 40 },
          { id: '690dbbd38b2c1830b8503e49', call: 1, made: 0, score: -10 },
          { id: '68b6434852044fa6096ee4cf', call: 0, made: 0, score: 20 }
        ]
      }
    ]
  };

  it('should accept a valid wizard game', async () => {
    // Mock Game methods
    Game.findOne = jest.fn().mockResolvedValue(null);
    Game.prototype.save = jest.fn().mockResolvedValue(true);

    const response = await request(app)
      .post('/api/games')
      .send({
        gameData: validWizardGame,
        localId: 'game_1765366835590_so12hsqnj'
      });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('message', 'Game created successfully');
    expect(response.body.game).toHaveProperty('gameData');
  });

  it('should reject game missing required fields', async () => {
    const invalidGame = { ...validWizardGame };
    delete invalidGame.created_at;

    const response = await request(app)
      .post('/api/games')
      .send({
        gameData: invalidGame,
        localId: 'game_invalid'
      });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error', 'Invalid game data structure');
    expect(response.body.validationErrors).toContain('created_at is required');
  });

  it('should reject game with too few players', async () => {
    const invalidGame = {
      ...validWizardGame,
      players: [
        { id: 'p1', name: 'Player 1' }
      ]
    };

    const response = await request(app)
      .post('/api/games')
      .send({
        gameData: invalidGame,
        localId: 'game_invalid'
      });

    expect(response.status).toBe(400);
    expect(response.body.validationErrors).toContain('At least 2 players required');
  });

  it('should reject game with too many players', async () => {
    const invalidGame = {
      ...validWizardGame,
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

    const response = await request(app)
      .post('/api/games')
      .send({
        gameData: invalidGame,
        localId: 'game_invalid'
      });

    expect(response.status).toBe(400);
    expect(response.body.validationErrors).toContain('Maximum 6 players allowed');
  });

  it('should reject game with missing round player data', async () => {
    const invalidGame = {
      ...validWizardGame,
      round_data: [
        {
          players: [
            { id: 'p1' } // missing made and score
          ]
        }
      ]
    };

    const response = await request(app)
      .post('/api/games')
      .send({
        gameData: invalidGame,
        localId: 'game_invalid'
      });

    expect(response.status).toBe(400);
    expect(response.body.validationErrors.some(e => e.includes('made is required'))).toBe(true);
  });

  it('should accept game with string winner_id', async () => {
    Game.findOne = jest.fn().mockResolvedValue(null);
    Game.prototype.save = jest.fn().mockResolvedValue(true);

    const gameWithStringWinner = {
      ...validWizardGame,
      winner_id: '69395b3e741c00d8598496ae'
    };

    const response = await request(app)
      .post('/api/games')
      .send({
        gameData: gameWithStringWinner,
        localId: 'game_string_winner'
      });

    expect(response.status).toBe(201);
  });

  it('should allow missing call field in round data', async () => {
    Game.findOne = jest.fn().mockResolvedValue(null);
    Game.prototype.save = jest.fn().mockResolvedValue(true);

    const gameWithoutCall = {
      ...validWizardGame,
      round_data: [
        {
          players: [
            { id: '6935c8eb16d6aab46cdcd818', made: 0, score: 20 },
            { id: '69395b3e741c00d8598496ae', made: 0, score: 20 }
          ]
        }
      ]
    };

    const response = await request(app)
      .post('/api/games')
      .send({
        gameData: gameWithoutCall,
        localId: 'game_no_call'
      });

    expect(response.status).toBe(201);
  });

  it('should reject game with invalid winner_id type', async () => {
    const invalidGame = {
      ...validWizardGame,
      winner_id: 12345 // number instead of string or array
    };

    const response = await request(app)
      .post('/api/games')
      .send({
        gameData: invalidGame,
        localId: 'game_invalid'
      });

    expect(response.status).toBe(400);
    expect(response.body.validationErrors).toContain('winner_id must be a string or array of strings');
  });

  it('should detect duplicate by localId', async () => {
    const existingGame = {
      _id: 'existing-game-id',
      userId: 'test-user-id',
      gameData: validWizardGame,
      createdAt: new Date()
    };

    Game.findOne = jest.fn().mockResolvedValue(existingGame);

    const response = await request(app)
      .post('/api/games')
      .send({
        gameData: validWizardGame,
        localId: 'game_1765366835590_so12hsqnj'
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('duplicate', true);
    expect(response.body).toHaveProperty('message', 'Game already exists (by localId)');
  });

});
