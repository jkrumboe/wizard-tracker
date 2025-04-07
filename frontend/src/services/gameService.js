import { gameAPI } from "./api"

// For offline/demo mode, we'll use mock data
const MOCK_MODE = true

// Mock game data
const mockGames = [
  {
    id: 1,
    date: "2023-04-15",
    players: ["Alice", "Bob", "Charlie", "David"],
    winner: "Alice",
    scores: {
      1: 120,
      2: 85,
      3: 95,
      4: 70,
    },
  },
  {
    id: 2,
    date: "2023-04-10",
    players: ["Bob", "Charlie", "Eve"],
    winner: "Eve",
    scores: {
      2: 110,
      3: 90,
      5: 130,
    },
  },
  {
    id: 3,
    date: "2023-04-05",
    players: ["Alice", "Eve", "David"],
    winner: "Alice",
    scores: {
      1: 140,
      5: 120,
      4: 95,
    },
  },
  {
    id: 4,
    date: "2023-03-28",
    players: ["Charlie", "David", "Eve", "Bob"],
    winner: "Charlie",
    scores: {
      3: 135,
      4: 90,
      5: 110,
      2: 105,
    },
  },
  {
    id: 5,
    date: "2023-03-20",
    players: ["Alice", "Bob", "Charlie", "David", "Eve"],
    winner: "Eve",
    scores: {
      1: 115,
      2: 95,
      3: 100,
      4: 85,
      5: 125,
    },
  },
]

// Mock player game history
const mockPlayerGameHistory = {
  1: [
    { id: 1, date: "2023-04-15", position: 1, score: 120, elo: 1250, players: "Alice, Bob, Charlie, David" },
    { id: 3, date: "2023-04-05", position: 1, score: 140, elo: 1240, players: "Alice, Eve, David" },
    { id: 5, date: "2023-03-20", position: 2, score: 115, elo: 1230, players: "Alice, Bob, Charlie, David, Eve" },
  ],
  2: [
    { id: 1, date: "2023-04-15", position: 2, score: 85, elo: 1180, players: "Alice, Bob, Charlie, David" },
    { id: 2, date: "2023-04-10", position: 3, score: 110, elo: 1175, players: "Bob, Charlie, Eve" },
    { id: 4, date: "2023-03-28", position: 4, score: 105, elo: 1170, players: "Charlie, David, Eve, Bob" },
  ],
  3: [
    { id: 1, date: "2023-04-15", position: 3, score: 95, elo: 1320, players: "Alice, Bob, Charlie, David" },
    { id: 2, date: "2023-04-10", position: 2, score: 90, elo: 1315, players: "Bob, Charlie, Eve" },
    { id: 4, date: "2023-03-28", position: 1, score: 135, elo: 1310, players: "Charlie, David, Eve, Bob" },
  ],
  4: [
    { id: 1, date: "2023-04-15", position: 4, score: 70, elo: 1150, players: "Alice, Bob, Charlie, David" },
    { id: 3, date: "2023-04-05", position: 3, score: 95, elo: 1145, players: "Alice, Eve, David" },
    { id: 4, date: "2023-03-28", position: 2, score: 90, elo: 1140, players: "Charlie, David, Eve, Bob" },
  ],
  5: [
    { id: 2, date: "2023-04-10", position: 1, score: 130, elo: 1280, players: "Bob, Charlie, Eve" },
    { id: 3, date: "2023-04-05", position: 2, score: 120, elo: 1275, players: "Alice, Eve, David" },
    { id: 4, date: "2023-03-28", position: 3, score: 110, elo: 1270, players: "Charlie, David, Eve, Bob" },
  ],
}

// Get recent games
export async function getRecentGames(limit = 3) {
  if (MOCK_MODE) {
    return Promise.resolve(mockGames.slice(0, limit))
  }
  return gameAPI.getRecent(limit)
}

// Get game by ID
export async function getGameById(id) {
  if (MOCK_MODE) {
    const game = mockGames.find((g) => g.id === Number.parseInt(id))
    return Promise.resolve(game || null)
  }
  return gameAPI.getById(id)
}

// Get player's game history
export async function getPlayerGameHistory(playerId) {
  if (MOCK_MODE) {
    return Promise.resolve(mockPlayerGameHistory[playerId] || [])
  }
  return gameAPI.getByPlayer(playerId)
}

// Create a new game
export async function createGame(gameData) {
  if (MOCK_MODE) {
    console.log("Creating game (mock):", gameData)
    return Promise.resolve({ ...gameData, id: Date.now() })
  }
  return gameAPI.create(gameData)
}

// Update game
export async function updateGame(id, gameData) {
  if (MOCK_MODE) {
    console.log("Updating game (mock):", id, gameData)
    return Promise.resolve({ ...gameData, id })
  }
  return gameAPI.update(id, gameData)
}

