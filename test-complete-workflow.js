// Complete Frontend Game Workflow Test
// This script tests the actual frontend workflow: local game state management + backend persistence

const API_BASE_URL = "http://localhost:5055/api";

async function fetchAPI(endpoint, options = {}) {
  try {
    const url = `${API_BASE_URL}${endpoint}`;
    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("API request failed:", error);
    throw error;
  }
}

function simulateGameState(players, maxRounds = 3) {
  console.log(`📋 Simulating game state for ${players.length} players, ${maxRounds} rounds...`);
  
  const roundData = [];
  const referenceDate = new Date();
  
  for (let round = 1; round <= maxRounds; round++) {
    const cards = round <= 10 ? round : 20 - round;
    const roundPlayers = players.map(player => {
      const call = Math.floor(Math.random() * (cards + 1)); // Random call
      const made = Math.floor(Math.random() * (cards + 1)); // Random made
      const score = call === made ? 20 + made * 10 : made * 10; // Wizard scoring
      
      return {
        id: player.id,
        name: player.name,
        call,
        made,
        score,
        totalScore: 0 // Will be calculated
      };
    });
    
    roundData.push({
      round,
      cards,
      players: roundPlayers
    });
  }
  
  // Calculate total scores
  for (let round = 0; round < maxRounds; round++) {
    roundData[round].players.forEach((player, playerIndex) => {
      const previousTotal = round > 0 ? roundData[round - 1].players[playerIndex].totalScore : 0;
      player.totalScore = previousTotal + player.score;
    });
  }
  
  return { roundData, referenceDate };
}

async function testCompleteWorkflow() {
  console.log("🎮 Starting Complete Frontend Game Workflow Test...\n");

  try {
    // Step 1: Load players (simulating NewGame.jsx)
    console.log("1️⃣ Loading players for game setup...");
    const players = await fetchAPI("/players");
    console.log(`✅ Loaded ${players.length} players`);
    
    // Step 2: Load tags
    console.log("\n2️⃣ Loading player tags...");
    const tags = await fetchAPI("/tags");
    console.log(`✅ Loaded ${tags.length} tags`);
    
    // Step 3: Select players (simulating user selection in NewGame)
    console.log("\n3️⃣ Selecting players for game...");
    const selectedPlayers = players.slice(0, 4);
    console.log(`✅ Selected players: ${selectedPlayers.map(p => p.name).join(", ")}`);
    
    // Step 4: Start game locally (simulating startGame in useGameState)
    console.log("\n4️⃣ Starting game with local state management...");
    const maxRounds = 3; // Shorter game for testing
    const mode = "Ranked";
    console.log(`✅ Game started: ${maxRounds} rounds, ${mode} mode`);
    
    // Step 5: Simulate game rounds (what happens in GameInProgress)
    console.log("\n5️⃣ Simulating game rounds...");
    const { roundData, referenceDate } = simulateGameState(selectedPlayers, maxRounds);
    
    for (let i = 0; i < maxRounds; i++) {
      const round = roundData[i];
      console.log(`   Round ${round.round}: ${round.cards} cards dealt`);
      round.players.forEach(player => {
        console.log(`     ${player.name}: called ${player.call}, made ${player.made}, score ${player.score}`);
      });
    }
    
    // Step 6: Calculate final results (simulating finishGame)
    console.log("\n6️⃣ Calculating final game results...");
    const lastRound = roundData[maxRounds - 1];
    const finalScores = {};
    let winnerId = null;
    let maxScore = Number.NEGATIVE_INFINITY;
    const duration = 45 * 60 * 1000; // Simulated 45 minute game
    
    lastRound.players.forEach(player => {
      finalScores[player.id] = player.totalScore;
      if (player.totalScore > maxScore) {
        maxScore = player.totalScore;
        winnerId = player.id;
      }
    });
    
    const winner = selectedPlayers.find(p => p.id === winnerId);
    console.log(`✅ Winner: ${winner.name} with ${maxScore} points`);
    
    // Step 7: Save completed game to backend (actual API call)
    console.log("\n7️⃣ Saving completed game to backend...");
    const gameData = {
      date: new Date().toISOString(),
      players: selectedPlayers.map(p => p.id),
      winner: winnerId,
      scores: finalScores,
      rounds: roundData,
      duration,
      mode
    };
    
    const savedGame = await fetchAPI("/games", {
      method: "POST",
      body: JSON.stringify(gameData)
    });
    console.log(`✅ Game saved with ID: ${savedGame.id}`);
    
    // Step 8: Verify game was saved correctly
    console.log("\n8️⃣ Verifying saved game...");
    const retrievedGame = await fetchAPI(`/games/${savedGame.id}`);
    console.log(`✅ Retrieved game: ${JSON.stringify(retrievedGame.players)} players`);
    
    // Step 9: Check updated player Elo ratings
    console.log("\n9️⃣ Checking updated player Elo ratings...");
    for (const player of selectedPlayers) {
      const updatedPlayer = await fetchAPI(`/players/${player.id}`);
      console.log(`   ${player.name}: ${player.elo} → ${updatedPlayer.elo} (${updatedPlayer.elo > player.elo ? '+' : ''}${updatedPlayer.elo - player.elo})`);
    }
    
    console.log("\n🎉 Complete frontend workflow test successful!");
    console.log("\n📊 Test Summary:");
    console.log(`   - Players: ${selectedPlayers.length}`);
    console.log(`   - Rounds: ${maxRounds}`);
    console.log(`   - Winner: ${winner.name}`);
    console.log(`   - Game ID: ${savedGame.id}`);
    console.log(`   - Mode: ${mode}`);
    
  } catch (error) {
    console.error("❌ Frontend workflow test failed:", error);
  }
}

testCompleteWorkflow().catch(console.error);
