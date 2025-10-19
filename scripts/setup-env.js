#!/usr/bin/env node

/**
 * Environment Setup Script
 * Generates secure JWT secret and updates .env file
 * Run this script on each deployment or update
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ENV_PATH = path.join(__dirname, '..', '.env');

function generateJWTSecret() {
  return crypto.randomBytes(64).toString('hex');
}

function updateEnvFile() {
  try {
    // Check if .env file exists
    if (!fs.existsSync(ENV_PATH)) {
      console.error('.env file not found at:', ENV_PATH);
      console.debug('Please copy .env.example to .env first');
      process.exit(1);
    }

    // Read current .env content
    let envContent = fs.readFileSync(ENV_PATH, 'utf8');
    
    // Generate new JWT secret
    const newJWTSecret = generateJWTSecret();
    
    // Update JWT_SECRET in the content
    envContent = envContent.replace(
      /JWT_SECRET=.*/,
      `JWT_SECRET=${newJWTSecret}`
    );
    
    // Write updated content back to .env
    fs.writeFileSync(ENV_PATH, envContent);
    
    console.debug('Environment setup completed!');
    console.debug('New JWT secret generated and updated in .env file');
    console.debug('Make sure to restart your application to use the new secret');
    
  } catch (error) {
    console.error('Error updating .env file:', error.message);
    process.exit(1);
  }
}

// Add this to package.json scripts
function updatePackageJson() {
  const packageJsonPath = path.join(__dirname, '..', 'package.json');
  
  if (fs.existsSync(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      
      if (!packageJson.scripts) {
        packageJson.scripts = {};
      }
      
      packageJson.scripts['setup-env'] = 'node scripts/setup-env.js';
      packageJson.scripts['update-secrets'] = 'node scripts/setup-env.js';
      
      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
      console.debug('Updated package.json with setup scripts');
    } catch (error) {
      console.debug('Could not update package.json:', error.message);
    }
  }
}

// Main execution
console.debug('Setting up Wizard Tracker environment...');
updateEnvFile();
updatePackageJson();

console.debug('\n Next steps:');
console.debug('1. Run: npm run setup-env (anytime you need new secrets)');
console.debug('2. For Docker: docker compose down && docker compose up -d');
console.debug('3. For local dev: npm run dev (in frontend) and npm start (in backend)');
