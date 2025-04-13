import { playerAPI } from "./api"

// For offline/demo mode, we'll use mock data
const MOCK_MODE = true

// Mock player data
const mockPlayers = [
  {
    id: 1,
    name: "Alice",
    avatar: "https://i.pravatar.cc/150?img=1",
    elo: 1250,
    winRate: 65,
    totalGames: 42,
    tags: ["Aggressive", "Strategic"],
  },
  {
    id: 2,
    name: "Bob",
    avatar: "https://i.pravatar.cc/150?img=2",
    elo: 1180,
    winRate: 52,
    totalGames: 38,
    tags: ["Defensive", "Consistent"],
  },
  {
    id: 3,
    name: "Charlie",
    avatar: "https://i.pravatar.cc/150?img=3",
    elo: 1320,
    winRate: 70,
    totalGames: 30,
    tags: ["Aggressive", "Risk-taker"],
  },
  {
    id: 4,
    name: "David",
    avatar: "https://i.pravatar.cc/150?img=4",
    elo: 1150,
    winRate: 48,
    totalGames: 25,
    tags: ["Beginner", "Improving"],
  },
  {
    id: 5,
    name: "Eve",
    avatar: "https://i.pravatar.cc/150?img=5",
    elo: 1280,
    winRate: 62,
    totalGames: 45,
    tags: ["Veteran", "Tactical"],
  },
]

// Get all players
export async function getPlayers() {
  if (MOCK_MODE) {
    return Promise.resolve(mockPlayers)
  }
  return playerAPI.getAll()
}

// Get player by ID
export async function getPlayerById(id) {
  if (MOCK_MODE) {
    const player = mockPlayers.find((p) => p.id === Number.parseInt(id))
    return Promise.resolve(player || null)
  }
  return playerAPI.getById(id)
}

// Create a new player
export async function createPlayer(playerData) {
  if (MOCK_MODE) {
    console.log("Creating player (mock):", playerData)
    return Promise.resolve({ ...playerData, id: Date.now() })
  }
  return playerAPI.create(playerData)
}

// Update player
export async function updatePlayer(id, playerData) {
  if (MOCK_MODE) {
    console.log("Updating player (mock):", id, playerData)
    return Promise.resolve({ ...playerData, id })
  }
  return playerAPI.update(id, playerData)
}

// Add a function to get player stats
export async function getPlayerStats(id) {
  if (MOCK_MODE) {
    const player = mockPlayers.find((p) => p.id === Number.parseInt(id))
    if (!player) return Promise.resolve(null)

    // Mock stats for the player
    const stats = {
      totalBids: Math.floor(Math.random() * 100),
      totalTricks: Math.floor(Math.random() * 100),
      correctBids: Math.floor(Math.random() * 50),
      bidAccuracy: (Math.random() * 100).toFixed(2),
      overbids: Math.floor(Math.random() * 20),
      underbids: Math.floor(Math.random() * 20),
      avgDiff: (Math.random() * 5).toFixed(2),
      totalPoints: Math.floor(Math.random() * 1000),
      avgPoints: (Math.random() * 100).toFixed(2),
      highestScore: Math.floor(Math.random() * 200),
      lowestScore: Math.floor(Math.random() * 50),
    }

    return Promise.resolve(stats)
  }
  return playerAPI.getStats(id)
}

