/**
 * Script: Unlink All Identities from Real Users
 * 
 * This script resets all identities that are currently linked to real users
 * (non-guest users) by setting their userId to null and type to 'guest'.
 * This allows them to be re-linked properly through the admin UI.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const PlayerIdentity = require('../models/PlayerIdentity');
const User = require('../models/User');

async function unlinkAllIdentities() {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://mongodb:27017/wizard-tracker');
    console.log('✅ Connected\n');
    
    console.log('Finding identities linked to real users...');
    
    // Get all real (non-guest) users
    const realUsers = await User.find({ role: { $ne: 'guest' } }, '_id username').lean();
    const realUserIds = realUsers.map(u => u._id);
    
    console.log(`Found ${realUsers.length} real users`);
    console.log(`Real users: ${realUsers.map(u => u.username).join(', ')}\n`);
    
    // Find identities linked to real users
    const linkedIdentities = await PlayerIdentity.find({
      userId: { $in: realUserIds },
      isDeleted: false
    }).populate('userId', 'username role');
    
    console.log(`Found ${linkedIdentities.length} identities linked to real users:\n`);
    
    let unlinked = 0;
    
    for (const identity of linkedIdentities) {
      console.log(`  - "${identity.displayName}" (${identity._id})`);
      console.log(`    Was linked to: ${identity.userId?.username || 'Unknown'} (${identity.userId?._id})`);
      
      // Unlink by setting userId to null
      identity.userId = null;
      identity.type = 'guest';
      await identity.save();
      
      console.log(`    ✅ Unlinked\n`);
      unlinked++;
    }
    
    console.log(`\n✅ Done! Unlinked ${unlinked} identities`);
    console.log(`These identities are now available for re-linking through the admin UI.\n`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from database');
  }
}

unlinkAllIdentities();
