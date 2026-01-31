#!/usr/bin/env node
/**
 * Calculate Initial ELO Ratings (Game-Type Specific)
 * 
 * This script processes all historical WizardGame and TableGame records 
 * chronologically and calculates ELO ratings for all players per game type.
 * 
 * Each game type (wizard, flip-7, dutch, etc.) has its own separate ELO rating.
 * 
 * Usage:
 *   # Dry run (no changes)
 *   node scripts/calculate-initial-elo.js --dry-run
 * 
 *   # Full recalculation for all game types
 *   node scripts/calculate-initial-elo.js
 * 
 *   # Recalculate specific game type only
 *   node scripts/calculate-initial-elo.js --game-type=wizard
 *   node scripts/calculate-initial-elo.js --game-type=flip-7
 * 
 *   # Use ELO development database
 *   MONGO_URI=$MONGO_URI_ELO_DEV node scripts/calculate-initial-elo.js
 * 
 * Environment:
 *   MONGO_URI - MongoDB connection string
 *   MONGO_URI_ELO_DEV - ELO development database (optional)
 */

require('dotenv').config();
const mongoose = require('mongoose');
const eloService = require('../utils/eloService');

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run') || args.includes('-d');
const useEloDev = args.includes('--elo-dev');
const verbose = args.includes('--verbose') || args.includes('-v');

// Extract game type if specified
const gameTypeArg = args.find(arg => arg.startsWith('--game-type='));
const specificGameType = gameTypeArg ? gameTypeArg.split('=')[1] : null;

async function main() {
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║   ELO Rating Calculation Script (Per Game Type)║');
  console.log('╚════════════════════════════════════════════════╝\n');
  
  // Determine which database to use
  let mongoUri = process.env.MONGO_URI;
  
  if (useEloDev && process.env.MONGO_URI_ELO_DEV) {
    mongoUri = process.env.MONGO_URI_ELO_DEV;
    console.log('🔧 Using ELO development database');
  }
  
  if (!mongoUri) {
    console.error('❌ MONGO_URI environment variable is not set');
    process.exit(1);
  }
  
  console.log(`📊 Mode: ${dryRun ? 'DRY RUN (no changes will be saved)' : 'LIVE'}`);
  console.log(`🗄️  Database: ${mongoUri.replace(/\/\/[^:]+:[^@]+@/, '//<credentials>@')}`);
  if (specificGameType) {
    console.log(`🎮 Game Type: ${specificGameType} only`);
  } else {
    console.log(`🎮 Game Types: ALL (wizard + table games)`);
  }
  console.log('');
  
  try {
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000
    });
    console.log('✓ Connected to MongoDB\n');
    
    // Load models (required for the service)
    require('../models/PlayerIdentity');
    require('../models/WizardGame');
    require('../models/TableGame');
    require('../models/User');
    
    // Show current stats before recalculation
    const PlayerIdentity = mongoose.model('PlayerIdentity');
    const WizardGame = mongoose.model('WizardGame');
    const TableGame = mongoose.model('TableGame');
    
    const identityCount = await PlayerIdentity.countDocuments({ isDeleted: false });
    const wizardGameCount = await WizardGame.countDocuments({ 'gameData.gameFinished': true });
    const tableGameCount = await TableGame.countDocuments({ status: 'completed' });
    
    // Get unique table game types
    const tableGameTypes = await TableGame.distinct('gameTypeName', { status: 'completed' });
    
    console.log('📈 Current State:');
    console.log(`   Player Identities: ${identityCount}`);
    console.log(`   Finished Wizard Games: ${wizardGameCount}`);
    console.log(`   Finished Table Games: ${tableGameCount}`);
    console.log(`   Table Game Types: ${tableGameTypes.length > 0 ? tableGameTypes.join(', ') : 'none'}`);
    console.log('');
    
    // Run recalculation with progress updates
    const startTime = Date.now();
    
    const result = await eloService.recalculateAllElo({
      dryRun,
      gameType: specificGameType, // null means all game types
      onProgress: (current, total) => {
        if (verbose && current % 10 === 0) {
          const percent = ((current / total) * 100).toFixed(1);
          process.stdout.write(`\r   Progress: ${current}/${total} (${percent}%)`);
        }
      }
    });
    
    if (verbose) {
      process.stdout.write('\n');
    }
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log('\n════════════════════════════════════════════════');
    console.log('📊 Results:');
    console.log(`   Games Processed: ${result.gamesProcessed}`);
    console.log(`   Player Updates: ${result.playerUpdates}`);
    console.log(`   Errors: ${result.errors.length}`);
    console.log(`   Duration: ${duration}s`);
    console.log(`   Dry Run: ${result.dryRun}`);
    
    // Show game type breakdown
    if (result.gameTypeStats) {
      console.log('\n📊 Games by Type:');
      for (const [gameType, count] of Object.entries(result.gameTypeStats)) {
        console.log(`   ${gameType}: ${count} games`);
      }
    }
    
    if (result.errors.length > 0 && verbose) {
      console.log('\n⚠️  Errors:');
      result.errors.slice(0, 10).forEach(err => {
        console.log(`   - Game ${err.gameId}: ${err.error}`);
      });
      if (result.errors.length > 10) {
        console.log(`   ... and ${result.errors.length - 10} more`);
      }
    }
    
    // Show top players after recalculation
    if (!dryRun) {
      // Show rankings for wizard games (or specified game type)
      const gameTypesToShow = specificGameType 
        ? [specificGameType] 
        : ['wizard', ...tableGameTypes.map(t => eloService.normalizeGameType(t))];
      
      for (const gameType of [...new Set(gameTypesToShow)]) {
        console.log(`\n🏆 Top 10 Players by ELO (${gameType}):`);
        try {
          const rankings = await eloService.getEloRankings({ 
            limit: 10, 
            minGames: 1,
            gameType 
          });
          
          if (rankings.rankings.length === 0) {
            console.log('   No ranked players yet');
            continue;
          }
          
          rankings.rankings.forEach((player, index) => {
            const streak = player.streak > 0 ? `+${player.streak}` : player.streak;
            console.log(
              `   ${(index + 1).toString().padStart(2)}. ${player.displayName.padEnd(20)} ` +
              `Rating: ${player.rating.toString().padStart(4)} ` +
              `(Peak: ${player.peak}, Games: ${player.gamesPlayed}, Streak: ${streak})`
            );
          });
        } catch (err) {
          console.log(`   Error fetching rankings: ${err.message}`);
        }
      }
    }
    
    console.log('\n✅ Done!');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (verbose) {
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

main();
