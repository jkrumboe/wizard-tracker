// Frontend Game Creation Workflow Test
// This script tests the complete frontend workflow by simulating API calls

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

async function testFrontendWorkflow() {
  console.log("🧪 Starting Frontend Game Creation Workflow Test...\n");

  try {
    // Step 1: Test player loading (simulating what NewGame.jsx does)
    console.log("1️⃣ Testing player loading...");
    const players = await fetchAPI("/players");
    console.log(`✅ Loaded ${players.length} players`);
    
    // Step 2: Test tags loading
    console.log("\n2️⃣ Testing tags loading...");
    const tags = await fetchAPI("/tags");
    console.log(`✅ Loaded ${tags.length} tags`);
    
    // Step 3: Select sample players for game (simulating user selection)
    console.log("\n3️⃣ Selecting sample players for game...");
    const selectedPlayers = players.slice(0, 4); // Select first 4 players
    console.log(`✅ Selected players: ${selectedPlayers.map(p => p.name).join(", ")}`);
    
    // Step 4: Create a new game (simulating what startGame does)
    console.log("\n4️⃣ Creating new game...");
    const gameData = {
      players: selectedPlayers.map(p => p.id),
      maxRounds: 10,
      mode: "Ranked",
      status: "in_progress"
    };
    
    const newGame = await fetchAPI("/games", {
      method: "POST",
      body: JSON.stringify(gameData)
    });
    console.log(`✅ Created game with ID: ${newGame.id}`);
    
    // Step 5: Test game retrieval
    console.log("\n5️⃣ Retrieving created game...");
    const retrievedGame = await fetchAPI(`/games/${newGame.id}`);
    console.log(`✅ Retrieved game: ${retrievedGame.id} with ${retrievedGame.players.length} players`);
    
    // Step 6: Create sample rounds (simulating game progress)
    console.log("\n6️⃣ Creating sample game rounds...");
    
    // Create round 1
    const round1Data = {
      game_id: newGame.id,
      round_number: 1,
      cards_dealt: 1,
      players: selectedPlayers.map(p => ({
        player_id: p.id,
        call: Math.floor(Math.random() * 2), // Random call 0-1 for round 1
        made: Math.floor(Math.random() * 2), // Random made 0-1
        score: 0 // Will be calculated
      }))
    };
    
    console.log("Creating round 1...");
    const round1 = await fetchAPI("/rounds", {
      method: "POST", 
      body: JSON.stringify(round1Data)
    });
    console.log(`✅ Created round 1 with ID: ${round1.id}`);
    
    // Step 7: Test game completion workflow
    console.log("\n7️⃣ Testing game completion...");
    const updatedGameData = {
      ...retrievedGame,
      status: "completed",
      finished_at: new Date().toISOString()
    };
    
    const completedGame = await fetchAPI(`/games/${newGame.id}`, {
      method: "PUT",
      body: JSON.stringify(updatedGameData)
    });
    console.log(`✅ Completed game: ${completedGame.id}`);
    
    // Step 8: Verify final state
    console.log("\n8️⃣ Verifying final game state...");
    const finalGame = await fetchAPI(`/games/${newGame.id}`);
    console.log(`✅ Final game status: ${finalGame.status}`);
    
    console.log("\n🎉 Frontend workflow test completed successfully!");
    console.log("\n📊 Test Summary:");
    console.log(`   - Players loaded: ${players.length}`);
    console.log(`   - Tags loaded: ${tags.length}`);
    console.log(`   - Game created: ID ${newGame.id}`);
    console.log(`   - Round created: ID ${round1.id}`);
    console.log(`   - Final status: ${finalGame.status}`);
    
  } catch (error) {
    console.error("❌ Frontend workflow test failed:", error);
    throw error;
  }
}

// Run the test
testFrontendWorkflow().catch(console.error);
