/**
 * Backfill Friend Requests and Friend Lists Script
 *
 * Migrates FriendRequest documents and User.friends arrays from MongoDB to PostgreSQL.
 * Requires users to be backfilled first!
 * Run with: node scripts/backfill-friends.js [--dry-run] [--batch-size=100]
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { connectDatabases, getPrisma } = require('../database');
const User = require('../models/User');
const FriendRequest = require('../models/FriendRequest');

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const batchSizeArg = args.find(arg => arg.startsWith('--batch-size='));
const BATCH_SIZE = batchSizeArg ? parseInt(batchSizeArg.split('=')[1]) : 100;

const stats = {
  requests: { total: 0, created: 0, skipped: 0, failed: 0 },
  friendships: { total: 0, created: 0, skipped: 0, failed: 0 },
  errors: []
};

async function backfillFriendRequests(prisma) {
  console.log('\n📨 Phase 1: Migrating Friend Requests...\n');

  const totalRequests = await FriendRequest.countDocuments();
  stats.requests.total = totalRequests;
  console.log(`📊 Found ${totalRequests} friend requests in MongoDB\n`);

  let skip = 0;
  let batchNumber = 1;

  while (skip < totalRequests) {
    const requests = await FriendRequest.find()
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(BATCH_SIZE)
      .lean();

    if (requests.length === 0) break;

    console.log(`📦 Batch ${batchNumber} (${requests.length} requests):`);

    for (const req of requests) {
      const senderId = req.sender.toString();
      const receiverId = req.receiver.toString();

      try {
        // Check for existing
        const existing = await prisma.friendRequest.findFirst({
          where: { senderId, receiverId }
        });

        if (existing) {
          console.log(`  ⏭️  Already exists: ${senderId} → ${receiverId}`);
          stats.requests.skipped++;
          continue;
        }

        // Verify both users exist in PG
        const [senderExists, receiverExists] = await Promise.all([
          prisma.user.findUnique({ where: { id: senderId }, select: { id: true } }),
          prisma.user.findUnique({ where: { id: receiverId }, select: { id: true } })
        ]);

        if (!senderExists || !receiverExists) {
          console.log(`  ⏭️  User not migrated yet: ${!senderExists ? senderId : receiverId}`);
          stats.requests.skipped++;
          continue;
        }

        if (isDryRun) {
          console.log(`  [DRY RUN] Would create: ${senderId} → ${receiverId} (${req.status})`);
          stats.requests.created++;
          continue;
        }

        await prisma.friendRequest.create({
          data: {
            senderId,
            receiverId,
            status: req.status,
            createdAt: req.createdAt,
            updatedAt: req.updatedAt || req.createdAt
          }
        });
        console.log(`  ✅ Created: ${senderId} → ${receiverId} (${req.status})`);
        stats.requests.created++;
      } catch (error) {
        if (error.code === 'P2002') {
          // Unique constraint - already exists
          stats.requests.skipped++;
        } else {
          console.error(`  ❌ Failed: ${senderId} → ${receiverId}:`, error.message);
          stats.requests.failed++;
          stats.errors.push({ type: 'request', senderId, receiverId, error: error.message });
        }
      }
    }

    skip += requests.length;
    batchNumber++;
  }
}

async function backfillFriendships(prisma) {
  console.log('\n🤝 Phase 2: Migrating Friend Lists...\n');

  const usersWithFriends = await User.find({ friends: { $exists: true, $ne: [] } })
    .select('_id username friends')
    .lean();

  stats.friendships.total = usersWithFriends.length;
  console.log(`📊 Found ${usersWithFriends.length} users with friends\n`);

  for (const user of usersWithFriends) {
    const userId = user._id.toString();

    for (const friendObjId of user.friends) {
      const friendId = friendObjId.toString();

      try {
        // Verify both users exist in PG
        const [userExists, friendExists] = await Promise.all([
          prisma.user.findUnique({ where: { id: userId }, select: { id: true } }),
          prisma.user.findUnique({ where: { id: friendId }, select: { id: true } })
        ]);

        if (!userExists || !friendExists) {
          stats.friendships.skipped++;
          continue;
        }

        if (isDryRun) {
          console.log(`  [DRY RUN] Would connect: ${user.username} ↔ ${friendId}`);
          stats.friendships.created++;
          continue;
        }

        // Connect friend (idempotent - Prisma ignores if already connected)
        await prisma.user.update({
          where: { id: userId },
          data: { friends: { connect: { id: friendId } } }
        });
        console.log(`  ✅ Connected: ${user.username} → ${friendId}`);
        stats.friendships.created++;
      } catch (error) {
        console.error(`  ❌ Failed: ${user.username} → ${friendId}:`, error.message);
        stats.friendships.failed++;
        stats.errors.push({ type: 'friendship', userId, friendId, error: error.message });
      }
    }
  }
}

async function backfillFriends() {
  console.log('🤝 Friends Backfill: MongoDB → PostgreSQL\n');
  if (isDryRun) console.log('🧪 DRY RUN MODE\n');

  try {
    console.log('🔌 Connecting to databases...');
    await connectDatabases();
    const prisma = getPrisma();
    console.log('✅ Connected\n');

    await backfillFriendRequests(prisma);
    await backfillFriendships(prisma);

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 Migration Summary');
    console.log('='.repeat(50));
    console.log('\nFriend Requests:');
    console.log(`  Total:     ${stats.requests.total}`);
    console.log(`  ✅ Created: ${stats.requests.created}`);
    console.log(`  ⏭️  Skipped: ${stats.requests.skipped}`);
    console.log(`  ❌ Failed:  ${stats.requests.failed}`);
    console.log('\nFriendships:');
    console.log(`  Total users: ${stats.friendships.total}`);
    console.log(`  ✅ Connected: ${stats.friendships.created}`);
    console.log(`  ⏭️  Skipped:  ${stats.friendships.skipped}`);
    console.log(`  ❌ Failed:   ${stats.friendships.failed}`);
    console.log('='.repeat(50));

    if (stats.errors.length > 0) {
      console.log('\n❌ Errors:');
      stats.errors.forEach((err, i) => console.log(`  ${i + 1}. [${err.type}] ${err.error}`));
    }

    console.log(isDryRun ? '\n🧪 DRY RUN COMPLETE' : '\n✅ Migration complete!');
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  } finally {
    await mongoose.connection.close();
    await getPrisma().$disconnect();
  }
}

if (require.main === module) {
  backfillFriends()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { backfillFriends };
