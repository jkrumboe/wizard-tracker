// Check what Colyseus rooms are currently active
import { Client } from 'colyseus.js';

async function checkActiveRooms() {
  console.log('🔍 Checking active Colyseus rooms...\n');
  
  try {
    const client = new Client('ws://localhost:5055');
    
    // Try to get lobby room to check if server is working
    console.log('1️⃣ Testing connection to Colyseus server...');
    const lobby = await client.joinOrCreate('lobby', {
      playerId: 999,
      playerName: 'TestChecker'
    });
    
    console.log('✅ Connected to lobby successfully');
    
    // Leave lobby immediately
    lobby.leave();
    
    console.log('2️⃣ Server is accessible, but no API to list active rooms directly');
    console.log('   Colyseus rooms are automatically disposed when empty');
    console.log('   This means old room IDs in database are likely stale');
    
  } catch (error) {
    console.error('❌ Failed to connect to Colyseus server:', error.message);
  }
}

checkActiveRooms();
