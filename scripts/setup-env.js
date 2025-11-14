#!/usr/bin/env node

/**
 * Environment Setup Script
 * Generates secure JWT secret and updates .env file
 * Run this script before first deployment or when rotating secrets
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

const ENV_PATH = path.join(__dirname, '..', '.env');

function log(message, type = 'info') {
  const icons = {
    success: `${colors.green}✓${colors.reset}`,
    error: `${colors.red}✗${colors.reset}`,
    warning: `${colors.yellow}⚠${colors.reset}`,
    info: `${colors.cyan}ℹ${colors.reset}`,
  };
  console.log(`${icons[type]} ${message}`);
}

function generateJWTSecret() {
  return crypto.randomBytes(64).toString('hex');
}

function updateEnvFile() {
  try {
    // Check if .env file exists
    if (!fs.existsSync(ENV_PATH)) {
      log('.env file not found', 'error');
      log('Please run: npm run init', 'info');
      log('Or copy .env.example to .env manually', 'info');
      process.exit(1);
    }

    // Read current .env content
    let envContent = fs.readFileSync(ENV_PATH, 'utf8');
    
    // Check if JWT_SECRET already has a secure value
    const currentSecretMatch = envContent.match(/JWT_SECRET=(.+)/);
    if (currentSecretMatch && currentSecretMatch[1].length > 32 && !currentSecretMatch[1].includes('your-secret-key-here')) {
      log('JWT_SECRET already configured', 'warning');
      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      
      rl.question(`${colors.yellow}Do you want to generate a new secret? (y/N): ${colors.reset}`, (answer) => {
        rl.close();
        if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
          log('Keeping existing JWT_SECRET', 'info');
          process.exit(0);
        }
        generateAndUpdate(envContent);
      });
      return;
    }
    
    generateAndUpdate(envContent);
    
  } catch (error) {
    log(`Error updating .env file: ${error.message}`, 'error');
    process.exit(1);
  }
}

function generateAndUpdate(envContent) {
  // Generate new JWT secret
  const newJWTSecret = generateJWTSecret();
  
  // Update JWT_SECRET in the content
  envContent = envContent.replace(
    /JWT_SECRET=.*/,
    `JWT_SECRET=${newJWTSecret}`
  );
  
  // Write updated content back to .env
  fs.writeFileSync(ENV_PATH, envContent);
  
  log('New JWT secret generated and saved to .env', 'success');
  log('Keep this secret secure and never commit it to version control', 'warning');
  log('Restart your application to use the new secret', 'info');
}

// Main execution
console.log(`${colors.bright}${colors.cyan}Wizard Tracker - Environment Setup${colors.reset}\n`);
updateEnvFile();
