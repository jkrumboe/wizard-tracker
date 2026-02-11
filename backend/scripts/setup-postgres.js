#!/usr/bin/env node

/**
 * PostgreSQL Setup Script
 * Initializes Prisma and runs first migration
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🗄️  PostgreSQL Migration Setup\n');

// Check if .env exists
const envPath = path.join(__dirname, '..', '.env');
if (!fs.existsSync(envPath)) {
  console.error('❌ .env file not found. Please create one based on .env.example');
  process.exit(1);
}

// Check if DATABASE_URL is set
require('dotenv').config();
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL not set in .env file');
  console.log('\nAdd this to your .env:');
  console.log('DATABASE_URL=postgresql://wizard:wizard123@localhost:5432/wizard_tracker?schema=public');
  process.exit(1);
}

console.log('✅ Environment variables configured');
console.log('   DATABASE_URL:', process.env.DATABASE_URL.replace(/:[^:@]+@/, ':***@'), '\n');

// Check if @prisma/client is installed
const prismaInstalled = fs.existsSync(path.join(__dirname, '..', 'node_modules', '@prisma'));
if (!prismaInstalled) {
  console.error('❌ Prisma not found in node_modules\n');
  console.log('Please install dependencies first:');
  console.log('  npm install\n');
  process.exit(1);
}

console.log('✅ Prisma CLI available\n');

// Function to check PostgreSQL connection using docker
async function checkPostgresViaDocker() {
  try {
    console.log('🔍 Checking if PostgreSQL container is running...');
    execSync('docker ps --filter name=wizard-postgres --format "{{.Names}}"', {
      stdio: 'pipe'
    });
    console.log('✅ Container is running\n');
    
    console.log('🔍 Testing connection to PostgreSQL...');
    // Try to connect using docker exec
    execSync('docker exec wizard-postgres pg_isready -U wizard', {
      stdio: 'pipe'
    });
    console.log('✅ PostgreSQL is ready\n');
    return true;
  } catch (error) {
    return false;
  }
}

// Main setup function
async function setup() {
  // Check PostgreSQL via Docker first
  const dockerOk = await checkPostgresViaDocker();
  
  if (!dockerOk) {
    console.error('❌ PostgreSQL container not accessible\n');
    console.log('Troubleshooting steps:');
    console.log('  1. Start container: docker compose up -d postgres');
    console.log('  2. Check logs: docker logs wizard-postgres');
    console.log('  3. Check status: docker ps | findstr postgres\n');
    process.exit(1);
  }
  
  // Generate Prisma client first (needed for migrations)
  console.log('🔄 Generating Prisma Client...');
  try {
    execSync('npx prisma generate', {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });
    console.log('✅ Prisma Client generated\n');
  } catch (error) {
    console.error('❌ Client generation failed');
    console.error(error.message);
    process.exit(1);
  }
  
  // Run migrations
  console.log('🔄 Running Prisma migrations...');
  console.log('   This will create all tables in the database\n');
  try {
    execSync('npx prisma migrate dev --name init', {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });
    console.log('\n✅ Migrations complete\n');
  } catch (error) {
    // Check if it's because migrations already exist
    if (error.message.includes('already exists') || error.message.includes('No migration found')) {
      console.log('⚠️  Migrations already applied or no changes detected\n');
    } else {
      console.error('❌ Migration failed');
      console.error(error.message);
      console.log('\nYou can try:');
      console.log('  - Reset database: npx prisma migrate reset');
      console.log('  - Or manually fix: docker exec -it wizard-postgres psql -U wizard -d wizard_tracker\n');
      process.exit(1);
    }
  }

  // Test the connection with Prisma Client
  console.log('🔍 Testing Prisma Client connection...');
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    await prisma.$connect();
    const result = await prisma.$queryRaw`SELECT version()`;
    console.log('✅ Connection successful');
    console.log('   PostgreSQL:', result[0].version.split(' ')[0], result[0].version.split(' ')[1]);
    await prisma.$disconnect();
  } catch (error) {
    console.error('⚠️  Connection test failed:', error.message);
    console.log('   But setup may have succeeded. Check DATABASE_URL in .env\n');
  }

  console.log('\n✨ PostgreSQL setup complete!\n');
  console.log('Next steps:');
  console.log('  1. View database: npm run prisma:studio');
  console.log('  2. Check health: curl http://localhost:5000/api/health');
  console.log('  3. Test connection: node scripts/test-postgres-connection.js');
  console.log('  4. Read guide: backend/POSTGRES_MIGRATION.md\n');
}

// Run setup
setup().catch(err => {
  console.error('Setup failed:', err);
  process.exit(1);
});
