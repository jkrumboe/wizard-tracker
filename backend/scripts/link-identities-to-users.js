/**
 * Script: Link PlayerIdentities to Users
 * 
 * This script ensures all PlayerIdentity records have corresponding User records.
 * - For identities without userId: creates guest User or links to existing User
 * - Updates the PlayerIdentity with the userId
 * 
 * Run with: node scripts/link-identities-to-users.js
 * 
 * Options:
 *   --dry-run     Preview changes without modifying database
 *   --verbose     Show detailed progress
 */

require('dotenv').config();
const mongoose = require('mongoose');
const PlayerIdentity = require('../models/PlayerIdentity');
const User = require('../models/User');

// Parse command line arguments
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const VERBOSE = args.includes('--verbose');

// Statistics
const stats = {
  identitiesProcessed: 0,
  identitiesUpdated: 0,
  identitiesSkipped: 0,
  guestUsersCreated: 0,
  usersLinked: 0,
  errors: []
};

function log(message, verbose = false) {
  if (!verbose || VERBOSE) {
    console.log(`[${new Date().toISOString()}] ${message}`);
  }
}

function logError(message, error) {
  console.error(`[${new Date().toISOString()}] ERROR: ${message}`, error?.message || error);
  stats.errors.push({ message, error: error?.message || String(error) });
}

async function connectDB() {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/wizard-tracker';
  
  log(`Connecting to MongoDB: ${mongoUri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}`);
  
  await mongoose.connect(mongoUri);
  log('Connected to MongoDB');
}

async function run() {
  await connectDB();
  
  log('=== Linking PlayerIdentities to Users ===');
  if (DRY_RUN) {
    log('DRY RUN MODE - No changes will be made');
  }
  
  // Find all identities without userId
  const identities = await PlayerIdentity.find({ 
    userId: { $exists: false },
    isDeleted: false 
  });
  
  log(`Found ${identities.length} identities without userId`);
  
  for (const identity of identities) {
    try {
      stats.identitiesProcessed++;
      
      const normalizedName = identity.normalizedName || identity.displayName.toLowerCase().trim();
      
      // Check if a user with this name already exists
      let user = await User.findOne({
        username: { $regex: new RegExp(`^${normalizedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
      });
      
      if (user) {
        // User exists - link identity to user
        if (!DRY_RUN) {
          identity.userId = user._id;
          identity.type = user.role === 'guest' ? 'guest' : 'registered';
          await identity.save();
        }
        stats.usersLinked++;
        log(`Linked identity "${identity.displayName}" to existing user ${user.username} (${user.role})`, true);
      } else {
        // No user exists - create guest user
        if (!DRY_RUN) {
          user = await User.create({
            username: identity.displayName,
            role: 'guest',
            passwordHash: null,
            guestMetadata: {
              originalGuestId: `guest_${identity._id}`
            }
          });
          
          identity.userId = user._id;
          identity.type = 'guest';
          await identity.save();
        }
        stats.guestUsersCreated++;
        stats.usersLinked++;
        log(`Created guest user for identity "${identity.displayName}"`, true);
      }
      
      stats.identitiesUpdated++;
      
    } catch (error) {
      // Handle duplicate key error (user might already exist)
      if (error.code === 11000) {
        log(`Username "${identity.displayName}" already exists, finding and linking...`, true);
        try {
          const existingUser = await User.findOne({
            username: { $regex: new RegExp(`^${identity.displayName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
          });
          if (existingUser && !DRY_RUN) {
            identity.userId = existingUser._id;
            identity.type = existingUser.role === 'guest' ? 'guest' : 'registered';
            await identity.save();
            stats.usersLinked++;
            stats.identitiesUpdated++;
            log(`Linked identity "${identity.displayName}" to user after retry`, true);
          }
        } catch (retryError) {
          logError(`Failed to link identity ${identity._id}`, retryError);
        }
      } else {
        logError(`Failed to process identity ${identity._id}`, error);
      }
    }
  }
  
  // Also check identities that have userId but the user doesn't exist
  log('\nChecking for orphaned identity references...');
  const identitiesWithUserId = await PlayerIdentity.find({ 
    userId: { $exists: true },
    isDeleted: false 
  });
  
  let orphaned = 0;
  for (const identity of identitiesWithUserId) {
    const user = await User.findById(identity.userId);
    if (!user) {
      orphaned++;
      log(`Orphaned: Identity "${identity.displayName}" references non-existent user ${identity.userId}`, true);
      
      // Create the missing guest user
      if (!DRY_RUN) {
        try {
          const newUser = await User.create({
            username: identity.displayName,
            role: 'guest',
            passwordHash: null,
            guestMetadata: {
              originalGuestId: `guest_${identity._id}`
            }
          });
          identity.userId = newUser._id;
          await identity.save();
          stats.guestUsersCreated++;
          log(`Created missing guest user for "${identity.displayName}"`, true);
        } catch (error) {
          if (error.code === 11000) {
            // User exists with this name, find and link
            const existingUser = await User.findOne({
              username: { $regex: new RegExp(`^${identity.displayName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
            });
            if (existingUser) {
              identity.userId = existingUser._id;
              await identity.save();
              log(`Linked to existing user "${existingUser.username}"`, true);
            }
          } else {
            logError(`Failed to fix orphaned identity ${identity._id}`, error);
          }
        }
      }
    }
  }
  log(`Found ${orphaned} orphaned identity references`);
  
  log('\n=== Complete ===');
  log(`Identities processed: ${stats.identitiesProcessed}`);
  log(`Identities updated: ${stats.identitiesUpdated}`);
  log(`Guest users created: ${stats.guestUsersCreated}`);
  log(`Users linked: ${stats.usersLinked}`);
  log(`Errors: ${stats.errors.length}`);
  
  if (stats.errors.length > 0) {
    log('\nErrors:');
    stats.errors.forEach((e, i) => {
      console.error(`  ${i + 1}. ${e.message}: ${e.error}`);
    });
  }
  
  await mongoose.disconnect();
  log('Disconnected from MongoDB');
}

run().catch(error => {
  console.error('Migration failed:', error.message);
  process.exit(1);
});
