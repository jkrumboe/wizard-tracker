/**
 * Diagnostic Script - Analyze Failed Migrations
 * Run: node scripts/diagnose-failed-migrations.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Game = require('../models/Game');
const { detectGameFormat, migrateWizardGame } = require('../utils/wizardGameMigration');

const FAILED_GAMES = [
  'game_1762435425690_zsk4kaauw',
  'game_1762466779543_4fcrxgnds',
  'game_1762545774764_ouszinbn2',
  'game_1764334403018_gny2rmj2x',
  'game_1764334403018_h5id5aiur',
  'game_1764334403019_nmks8s3u7',
  'game_1764334403021_ezctqlj57',
  'game_1764334403023_dswya3wrd',
  'game_1764334403025_k4dexwylf',
  'game_1764455658665_onrcfex6y',
  'game_1765394983707_1z6wriwt2',
  'game_1765412800453_weq27jitf',
  'game_1765412909217_dz0u00ach',
  'game_1765413314543_wbdh3k5uy'
];

async function diagnoseFailures() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');
    console.log('🔍 Analyzing failed games...\n');

    for (const localId of FAILED_GAMES) {
      console.log(`\n${'='.repeat(70)}`);
      console.log(`Game: ${localId}`);
      console.log('='.repeat(70));

      const game = await Game.findOne({ localId }).lean();
      
      if (!game) {
        console.log('❌ Game not found in database');
        continue;
      }

      // Detect format
      const version = detectGameFormat(game.gameData);
      console.log(`Format detected: v${version}`);

      // Show player count
      const players = game.gameData.players || game.gameData.gameState?.players || [];
      console.log(`Player count: ${players.length}`);
      
      if (players.length > 0) {
        console.log('Players:');
        players.slice(0, 3).forEach((p, idx) => {
          console.log(`  ${idx + 1}. ${p.name} (${p.id})`);
        });
        if (players.length > 3) {
          console.log(`  ... and ${players.length - 3} more`);
        }
      } else {
        console.log('⚠️  No players found!');
        console.log('GameData structure:', Object.keys(game.gameData));
        if (game.gameData.gameState) {
          console.log('GameState structure:', Object.keys(game.gameData.gameState));
        }
      }

      // Try migration
      const { migrated, originalVersion, needsMigration, error } = migrateWizardGame(game.gameData);
      
      if (error) {
        console.log(`❌ Migration error: ${error}`);
      } else {
        console.log(`✅ Migration successful (v${originalVersion} → v3.0)`);
        console.log(`Migrated player count: ${migrated.players?.length || 0}`);
        
        if (migrated.players && migrated.players.length > 0) {
          console.log('Issue: Player count exceeds limit (max 6, have', migrated.players.length, ')');
        } else {
          console.log('Issue: Players array is empty after migration');
        }
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('📊 SUMMARY');
    console.log('='.repeat(70));
    
    // Count by issue type
    const gamesWithTooManyPlayers = [];
    const gamesWithNoPlayers = [];
    
    for (const localId of FAILED_GAMES) {
      const game = await Game.findOne({ localId }).lean();
      if (!game) continue;
      
      const { migrated } = migrateWizardGame(game.gameData);
      const playerCount = migrated.players?.length || 0;
      
      if (playerCount > 6) {
        gamesWithTooManyPlayers.push({ localId, count: playerCount });
      } else if (playerCount < 2) {
        gamesWithNoPlayers.push({ localId, count: playerCount });
      }
    }
    
    console.log(`\nGames with > 6 players: ${gamesWithTooManyPlayers.length}`);
    gamesWithTooManyPlayers.forEach(g => {
      console.log(`  - ${g.localId}: ${g.count} players`);
    });
    
    console.log(`\nGames with < 2 players: ${gamesWithNoPlayers.length}`);
    gamesWithNoPlayers.forEach(g => {
      console.log(`  - ${g.localId}: ${g.count} players`);
    });

    console.log('\n💡 Recommendations:');
    if (gamesWithTooManyPlayers.length > 0) {
      console.log('  1. Increase max player limit in schema (2-8 or 2-10)');
    }
    if (gamesWithNoPlayers.length > 0) {
      console.log('  2. Fix migration logic to preserve players from gameState');
    }

    await mongoose.connection.close();

  } catch (error) {
    console.error('💥 Error:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

diagnoseFailures();
