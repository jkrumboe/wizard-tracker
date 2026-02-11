#!/usr/bin/env node

/**
 * Test PostgreSQL Connection
 * Simple script to verify DATABASE_URL works
 */

require('dotenv').config();

console.log('🔍 Testing PostgreSQL connection...\n');
console.log('DATABASE_URL:', process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':***@'), '\n');

const { PrismaClient } = require('@prisma/client');

async function testConnection() {
  const prisma = new PrismaClient();
  
  try {
    console.log('Attempting to connect...');
    await prisma.$connect();
    console.log('✅ Connected to PostgreSQL');
    
    console.log('Running test query...');
    const result = await prisma.$queryRaw`SELECT version()`;
    console.log('✅ Query successful');
    console.log('PostgreSQL version:', result[0].version.split(' ').slice(0, 2).join(' '));
    
    await prisma.$disconnect();
    console.log('\n✨ Connection test passed!\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    console.error('\nError details:', error);
    
    console.log('\nTroubleshooting:');
    console.log('  1. Verify DATABASE_URL in .env file');
    console.log('  2. Check PostgreSQL is running: docker ps');
    console.log('  3. Check PostgreSQL logs: docker logs wizard-postgres');
    console.log('  4. Try connecting manually: docker exec -it wizard-postgres psql -U wizard -d wizard_tracker');
    
    await prisma.$disconnect();
    process.exit(1);
  }
}

testConnection();
