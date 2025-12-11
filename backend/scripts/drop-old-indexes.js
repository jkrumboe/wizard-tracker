/**
 * Drop old indexes that conflict with winner_id being an array
 * Run this script to fix the "cannot index parallel arrays" error
 */

const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://admin:password123@localhost:27017/wizard-tracker?authSource=admin';

async function dropOldIndexes() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const gamesCollection = db.collection('games');

    console.log('\nCurrent indexes:');
    const indexes = await gamesCollection.indexes();
    indexes.forEach(index => {
      console.log(`  - ${index.name}:`, JSON.stringify(index.key));
    });

    // Drop all indexes except _id
    console.log('\nDropping all custom indexes...');
    await gamesCollection.dropIndexes();
    console.log('✅ Dropped all custom indexes');

    // Recreate only the safe indexes (ones we kept in the model)
    console.log('\nRecreating safe indexes...');
    
    // localId index (unique)
    await gamesCollection.createIndex({ localId: 1 }, { unique: true });
    console.log('✅ Created localId index');
    
    // shareId index (sparse)
    await gamesCollection.createIndex({ shareId: 1 }, { sparse: true });
    console.log('✅ Created shareId index');
    
    // userId + createdAt compound index
    await gamesCollection.createIndex({ userId: 1, createdAt: -1 });
    console.log('✅ Created userId + createdAt index');

    console.log('\nFinal indexes:');
    const finalIndexes = await gamesCollection.indexes();
    finalIndexes.forEach(index => {
      console.log(`  - ${index.name}:`, JSON.stringify(index.key));
    });

    console.log('\n✅ Index migration complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

dropOldIndexes();
