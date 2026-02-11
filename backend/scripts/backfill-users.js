/**
 * Backfill Users Script
 * 
 * Migrates all users from MongoDB to PostgreSQL
 * Run with: node scripts/backfill-users.js [--dry-run] [--batch-size=100]
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { connectDatabases, getPrisma } = require('../database');
const User = require('../models/User');
const UserRepository = require('../repositories/UserRepository');

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const batchSizeArg = args.find(arg => arg.startsWith('--batch-size='));
const BATCH_SIZE = batchSizeArg ? parseInt(batchSizeArg.split('=')[1]) : 100;

// Migration statistics
const stats = {
  total: 0,
  created: 0,
  skipped: 0,
  failed: 0,
  errors: []
};

/**
 * Migrate a single user from MongoDB to PostgreSQL
 */
async function migrateUser(mongoUser, prisma) {
  try {
    // Check if user already exists in PostgreSQL
    const existingUser = await UserRepository.findByCaseInsensitiveUsername(prisma, mongoUser.username);
    
    if (existingUser) {
      console.log(`  ⏭️  User already exists: ${mongoUser.username} (${mongoUser._id})`);
      stats.skipped++;
      return { status: 'skipped', user: mongoUser };
    }

    if (isDryRun) {
      console.log(`  [DRY RUN] Would create: ${mongoUser.username} (${mongoUser._id})`);
      stats.created++;
      return { status: 'dry-run', user: mongoUser };
    }

    // Create user in PostgreSQL
    const pgUser = await UserRepository.createFromMongo(prisma, mongoUser);
    console.log(`  ✅ Created: ${mongoUser.username} (${mongoUser._id} → ${pgUser.id})`);
    stats.created++;
    
    return { status: 'created', user: pgUser };
  } catch (error) {
    console.error(`  ❌ Failed to migrate ${mongoUser.username}:`, error.message);
    stats.failed++;
    stats.errors.push({
      userId: mongoUser._id.toString(),
      username: mongoUser.username,
      error: error.message
    });
    return { status: 'failed', user: mongoUser, error };
  }
}

/**
 * Process a batch of users
 */
async function processBatch(users, prisma, batchNumber) {
  console.log(`\n📦 Processing batch ${batchNumber} (${users.length} users)...`);
  
  const results = [];
  for (const user of users) {
    const result = await migrateUser(user, prisma);
    results.push(result);
  }
  
  return results;
}

/**
 * Main migration function
 */
async function backfillUsers() {
  console.log('🗄️  User Backfill: MongoDB → PostgreSQL\n');
  
  if (isDryRun) {
    console.log('🧪 DRY RUN MODE - No data will be written\n');
  }
  
  console.log(`⚙️  Configuration:`);
  console.log(`   Batch Size: ${BATCH_SIZE}`);
  console.log(`   Dry Run: ${isDryRun}\n`);

  try {
    // Connect to databases
    console.log('🔌 Connecting to databases...');
    await connectDatabases();
    const prisma = getPrisma();
    console.log('✅ Connected to both databases\n');

    // Count total users in MongoDB
    const totalUsers = await User.countDocuments();
    stats.total = totalUsers;
    console.log(`📊 Found ${totalUsers} users in MongoDB\n`);

    if (totalUsers === 0) {
      console.log('ℹ️  No users to migrate');
      return;
    }

    // Process users in batches
    let batchNumber = 1;
    let skip = 0;
    
    while (skip < totalUsers) {
      const users = await User.find()
        .sort({ createdAt: 1 })
        .skip(skip)
        .limit(BATCH_SIZE)
        .lean();
      
      if (users.length === 0) break;
      
      await processBatch(users, prisma, batchNumber);
      
      skip += users.length;
      batchNumber++;
      
      // Progress update
      const progress = Math.round((skip / totalUsers) * 100);
      console.log(`\n📈 Progress: ${skip}/${totalUsers} (${progress}%)`);
    }

    // Print summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 Migration Summary');
    console.log('='.repeat(50));
    console.log(`Total Users:      ${stats.total}`);
    console.log(`✅ Created:       ${stats.created}`);
    console.log(`⏭️  Skipped:       ${stats.skipped}`);
    console.log(`❌ Failed:        ${stats.failed}`);
    console.log('='.repeat(50));

    if (stats.failed > 0) {
      console.log('\n❌ Errors:');
      stats.errors.forEach((err, index) => {
        console.log(`\n${index + 1}. User: ${err.username} (${err.userId})`);
        console.log(`   Error: ${err.error}`);
      });
    }

    if (isDryRun) {
      console.log('\n🧪 DRY RUN COMPLETE - No data was written');
    } else {
      console.log('\n✅ Migration complete!');
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  } finally {
    // Cleanup
    console.log('\n🔌 Closing database connections...');
    await mongoose.connection.close();
    await getPrisma().$disconnect();
    console.log('✅ Connections closed');
  }
}

// Run the script
if (require.main === module) {
  backfillUsers()
    .then(() => {
      console.log('\n✨ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Script failed:', error);
      process.exit(1);
    });
}

module.exports = { backfillUsers };
