/**
 * Example Game Data Using New Schema
 * This demonstrates the improved structure and consistency
 */

export const EXAMPLE_GAME_NEW_SCHEMA = {
  "version": 1,
  "schema": "wizard-tracker@1",
  "id": "game_1754865120481193_abc123def",
  "name": "Finished Game - 2025-08-11",
  "mode": "local",
  "status": "completed",
  "created_at": "2025-08-10T22:32:05.068Z",
  "updated_at": "2025-08-10T22:32:15.634Z",
  "started_at": "2025-08-10T22:32:05.068Z",
  "finished_at": "2025-08-10T22:32:15.634Z",
  "duration_seconds": 10,

  "players": [
    {
      "id": "player_1754865120481193_bailey",
      "name": "Bailey",
      "is_host": true,
      "seat_position": 0,
      "avatar": null
    },
    {
      "id": "player_1754865120679172_casey", 
      "name": "Casey",
      "is_host": false,
      "seat_position": 1,
      "avatar": null
    },
    {
      "id": "player_1754865120827158_jordan",
      "name": "Jordan", 
      "is_host": false,
      "seat_position": 2,
      "avatar": null
    }
  ],

  "rounds": [
    {
      "number": 1,
      "cards": 1,
      "bids": {
        "player_1754865120481193_bailey": 0,
        "player_1754865120679172_casey": 0,
        "player_1754865120827158_jordan": 0
      },
      "tricks": {
        "player_1754865120481193_bailey": 1,
        "player_1754865120679172_casey": 0,
        "player_1754865120827158_jordan": 0
      },
      "points": {
        "player_1754865120481193_bailey": -10,
        "player_1754865120679172_casey": 20,
        "player_1754865120827158_jordan": 20
      }
    },
    {
      "number": 2,
      "cards": 2,
      "bids": {
        "player_1754865120481193_bailey": 1,
        "player_1754865120679172_casey": 1,
        "player_1754865120827158_jordan": 1
      },
      "tricks": {
        "player_1754865120481193_bailey": 1,
        "player_1754865120679172_casey": 1,
        "player_1754865120827158_jordan": 0
      },
      "points": {
        "player_1754865120481193_bailey": 30,
        "player_1754865120679172_casey": 30,
        "player_1754865120827158_jordan": -10
      }
    }
  ],

  "totals": {
    "final_scores": {
      "player_1754865120481193_bailey": 20,
      "player_1754865120679172_casey": 50,
      "player_1754865120827158_jordan": 10
    },
    "winner_id": "player_1754865120679172_casey",
    "total_rounds": 2
  },

  "metadata": {
    "is_local": true,
    "notes": null,
    "tags": ["casual", "quick-game"],
    "rules": null,
    "seat_order": [
      "player_1754865120481193_bailey",
      "player_1754865120679172_casey", 
      "player_1754865120827158_jordan"
    ]
  }
};

export const EXAMPLE_PAUSED_GAME_NEW_SCHEMA = {
  "version": 1,
  "schema": "wizard-tracker@1",
  "id": "game_1754865120999888_xyz789abc",
  "name": "Paused Game - Round 3/5",
  "mode": "local", 
  "status": "paused",
  "created_at": "2025-08-11T10:15:30.123Z",
  "updated_at": "2025-08-11T10:45:22.456Z",
  "started_at": "2025-08-11T10:15:30.123Z",
  "finished_at": null,
  "duration_seconds": null,

  "players": [
    {
      "id": "player_1754865120999001_alice",
      "name": "Alice",
      "is_host": true,
      "seat_position": 0,
      "avatar": null
    },
    {
      "id": "player_1754865120999002_bob",
      "name": "Bob", 
      "is_host": false,
      "seat_position": 1,
      "avatar": null
    },
    {
      "id": "player_1754865120999003_charlie",
      "name": "Charlie",
      "is_host": false,
      "seat_position": 2,
      "avatar": null
    },
    {
      "id": "player_1754865120999004_diana",
      "name": "Diana",
      "is_host": false, 
      "seat_position": 3,
      "avatar": null
    }
  ],

  "rounds": [
    {
      "number": 1,
      "cards": 1,
      "bids": {
        "player_1754865120999001_alice": 1,
        "player_1754865120999002_bob": 0,
        "player_1754865120999003_charlie": 0,
        "player_1754865120999004_diana": 0
      },
      "tricks": {
        "player_1754865120999001_alice": 1,
        "player_1754865120999002_bob": 0,
        "player_1754865120999003_charlie": 0,
        "player_1754865120999004_diana": 0
      },
      "points": {
        "player_1754865120999001_alice": 30,
        "player_1754865120999002_bob": 20,
        "player_1754865120999003_charlie": 20,
        "player_1754865120999004_diana": 20
      }
    },
    {
      "number": 2,
      "cards": 2,
      "bids": {
        "player_1754865120999001_alice": 1,
        "player_1754865120999002_bob": 1,
        "player_1754865120999003_charlie": 0,
        "player_1754865120999004_diana": 0
      },
      "tricks": {
        "player_1754865120999001_alice": 0,
        "player_1754865120999002_bob": 2,
        "player_1754865120999003_charlie": 0,
        "player_1754865120999004_diana": 0
      },
      "points": {
        "player_1754865120999001_alice": -10,
        "player_1754865120999002_bob": 40,
        "player_1754865120999003_charlie": 20,
        "player_1754865120999004_diana": 20
      }
    }
  ],

  "totals": {
    "final_scores": {
      "player_1754865120999001_alice": 20,
      "player_1754865120999002_bob": 60,
      "player_1754865120999003_charlie": 40,
      "player_1754865120999004_diana": 40
    },
    "winner_id": null,
    "total_rounds": 5
  },

  "metadata": {
    "is_local": true,
    "notes": "Paused during round 3 - Alice had to leave",
    "tags": ["family-game", "long-session"],
    "rules": {
      "scoring_variant": "standard",
      "allow_pass": true
    },
    "seat_order": [
      "player_1754865120999001_alice",
      "player_1754865120999002_bob",
      "player_1754865120999003_charlie", 
      "player_1754865120999004_diana"
    ]
  }
};

/**
 * Example of how the old format looks vs new format
 */
export const COMPARISON_OLD_VS_NEW = {
  
  // OLD FORMAT (with duplication and inconsistency)
  old: {
    "id": "1754865120481193",
    "name": "Finished Game - 2025-08-11",
    "gameState": {
      "players": [
        {"id": "1754865120481193", "name": "Bailey"},
        {"id": "1754865120679172", "name": "Casey"},
        {"id": "1754865120827158", "name": "Jordan"}
      ],
      "currentRound": 3,
      "maxRounds": 2,
      "roundData": [
        {
          "cards": 1,
          "players": [
            {"id": "1754865120481193", "bid": 0, "tricks": 1, "score": -10},
            {"id": "1754865120679172", "bid": 0, "tricks": 0, "score": 20},
            {"id": "1754865120827158", "bid": 0, "tricks": 0, "score": 20}
          ]
        }
      ],
      "gameFinished": true,
      "final_scores": {"1754865120481193": 20, "1754865120679172": 50, "1754865120827158": 10},
      "winner_id": "1754865120679172"
    },
    "savedAt": "2025-08-10T22:32:15.634Z",
    "lastPlayed": "2025-08-10T22:32:15.634Z",
    "created_at": "2025-08-10T22:32:05.068Z",
    "playerCount": 3,
    "roundsCompleted": 2,
    "totalRounds": 2,
    "mode": "Local",
    "isPaused": false,
    "gameFinished": true,
    // Duplication starts here
    "winner_id": "1754865120679172",
    "final_scores": {"1754865120481193": 20, "1754865120679172": 50, "1754865120827158": 10},
    "player_ids": ["1754865120481193", "1754865120679172", "1754865120827158"],
    "total_rounds": 2,
    "duration_seconds": 10,
    "is_local": true
  },
  
  // NEW FORMAT (clean, single source of truth)
  new: EXAMPLE_GAME_NEW_SCHEMA
};

export default {
  EXAMPLE_GAME_NEW_SCHEMA,
  EXAMPLE_PAUSED_GAME_NEW_SCHEMA,
  COMPARISON_OLD_VS_NEW
};
