#!/usr/bin/env node
/**
 * Copy Production Data to Development Database
 * 
 * This script helps you safely copy production data to a development
 * database within the same MongoDB instance for testing.
 * 
 * Databases:
 *   - wizard-tracker        : Production
 *   - wizard-tracker-dev    : Development (copy of prod for testing)
 *   - wizard-tracker-backup : Backups
 * 
 * Prerequisites:
 *   1. MongoDB container running: docker compose up mongodb -d
 *   2. Access to production MongoDB (local or remote)
 * 
 * Usage:
 *   node scripts/copy-prod-to-dev.js
 *   node scripts/copy-prod-to-dev.js --all        # Copy all collections
 *   node scripts/copy-prod-to-dev.js --backup     # Also create backup
 *   node scripts/copy-prod-to-dev.js --help
 * 
 * Environment:
 *   MONGO_URI_PROD - Production MongoDB (default: localhost:27017/wizard-tracker)
 *   MONGO_URI_DEV  - Development database (default: localhost:27017/wizard-tracker-dev)
 */

require('dotenv').config();
const mongoose = require('mongoose');

// Default URIs - same MongoDB instance, different databases
const DEFAULT_PROD_URI = 'mongodb://localhost:27017/wizard-tracker';
const DEFAULT_DEV_URI = 'mongodb://localhost:27017/wizard-tracker-dev';
const DEFAULT_BACKUP_URI = 'mongodb://localhost:27017/wizard-tracker-backup';

// Collections to copy (essential for ELO and game data)
const ESSENTIAL_COLLECTIONS = [
  'wizard',           // WizardGame documents
  'playeridentities', // PlayerIdentity documents  
  'users'             // User documents
];

// All collections for full copy
const ALL_COLLECTIONS = [
  'wizard',
  'playeridentities', 
  'users',
  'games',
  'tablegames',
  'gametemplates',
  'systemgametemplates',
  'usergametemplates',
  'migrations'
];

// Parse command line arguments
const args = process.argv.slice(2);
const showHelp = args.includes('--help') || args.includes('-h');
const copyAll = args.includes('--all');
const createBackup = args.includes('--backup');

function printHelp() {
  console.log(`
╔════════════════════════════════════════════════════════════════════╗
║       Copy Production Data to Development Database                 ║
╚════════════════════════════════════════════════════════════════════╝

Copies data from production to a development database for safe testing.
Both databases are in the same MongoDB instance.

DATABASES:
  wizard-tracker        - Production (live data)
  wizard-tracker-dev    - Development (your testing copy)
  wizard-tracker-backup - Backup storage

USAGE:
  node scripts/copy-prod-to-dev.js [options]

OPTIONS:
  --help, -h    Show this help message
  --all         Copy all collections (not just essential ones)
  --backup      Also copy to backup database

ENVIRONMENT VARIABLES (optional):
  MONGO_URI_PROD   Source database (default: mongodb://localhost:27017/wizard-tracker)
  MONGO_URI_DEV    Target dev database (default: mongodb://localhost:27017/wizard-tracker-dev)

EXAMPLES:
  # Copy essential collections (wizard, users, playeridentities)
  node scripts/copy-prod-to-dev.js

  # Copy all collections
  node scripts/copy-prod-to-dev.js --all

  # Copy and create backup
  node scripts/copy-prod-to-dev.js --backup

AFTER COPYING:
  # Run backend against dev database
  npm run dev:local

  # Calculate ELO ratings
  npm run elo:dev
`);
}

async function copyCollection(sourceDb, targetDb, collectionName) {
  try {
    const sourceCollection = sourceDb.collection(collectionName);
    const targetCollection = targetDb.collection(collectionName);
    
    // Check if source collection exists and has documents
    const count = await sourceCollection.countDocuments();
    if (count === 0) {
      console.log(`   ⏭️  ${collectionName}: empty, skipping`);
      return 0;
    }
    
    // Drop target collection and copy all documents
    await targetCollection.drop().catch(() => {}); // Ignore if doesn't exist
    
    const docs = await sourceCollection.find({}).toArray();
    if (docs.length > 0) {
      await targetCollection.insertMany(docs);
    }
    
    console.log(`   ✅ ${collectionName}: ${docs.length} documents`);
    return docs.length;
  } catch (error) {
    console.log(`   ❌ ${collectionName}: ${error.message}`);
    return 0;
  }
}

async function copyDatabase(sourceUri, targetUri, collections, label) {
  console.log(`\n📦 Copying to ${label}...`);
  console.log(`   Source: ${sourceUri.replace(/\/\/[^:]+:[^@]+@/, '//<credentials>@')}`);
  console.log(`   Target: ${targetUri.replace(/\/\/[^:]+:[^@]+@/, '//<credentials>@')}\n`);
  
  const sourceConn = await mongoose.createConnection(sourceUri).asPromise();
  const targetConn = await mongoose.createConnection(targetUri).asPromise();
  
  const sourceDb = sourceConn.db;
  const targetDb = targetConn.db;
  
  let totalDocs = 0;
  
  for (const collection of collections) {
    totalDocs += await copyCollection(sourceDb, targetDb, collection);
  }
  
  await sourceConn.close();
  await targetConn.close();
  
  console.log(`\n   📊 Total: ${totalDocs} documents copied`);
  return totalDocs;
}

async function main() {
  if (showHelp) {
    printHelp();
    return;
  }
  
  console.log(`
╔════════════════════════════════════════════════════════════════════╗
║       Copy Production Data to Development Database                 ║
╚════════════════════════════════════════════════════════════════════╝
`);

  const prodUri = process.env.MONGO_URI_PROD || DEFAULT_PROD_URI;
  const devUri = process.env.MONGO_URI_DEV || DEFAULT_DEV_URI;
  const backupUri = process.env.MONGO_URI_BACKUP || DEFAULT_BACKUP_URI;
  
  const collections = copyAll ? ALL_COLLECTIONS : ESSENTIAL_COLLECTIONS;
  
  console.log(`📋 Collections: ${collections.join(', ')}`);
  console.log(`🔧 Mode: ${copyAll ? 'Full copy' : 'Essential only'}`);
  
  try {
    // Copy to dev
    await copyDatabase(prodUri, devUri, collections, 'Development');
    
    // Optionally copy to backup
    if (createBackup) {
      await copyDatabase(prodUri, backupUri, collections, 'Backup');
    }
    
    console.log(`
════════════════════════════════════════════════════════════════════
✅ Copy complete!

NEXT STEPS:
  # Start backend with dev database
  npm run dev:local

  # Or calculate ELO ratings
  npm run elo:dev

  # View in Mongo Express
  http://localhost:18081 → wizard-tracker-dev
════════════════════════════════════════════════════════════════════
`);
    
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    process.exit(1);
  }
}

main();
