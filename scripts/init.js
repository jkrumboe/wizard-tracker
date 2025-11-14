#!/usr/bin/env node

/**
 * Initialization Script for Wizard Tracker
 * Sets up the project for first-time use
 * Creates .env files from templates and provides setup guidance
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function header(message) {
  console.log(`\n${colors.bright}${colors.blue}${message}${colors.reset}`);
  console.log('='.repeat(message.length));
}

function success(message) {
  log(`✓ ${message}`, colors.green);
}

function error(message) {
  log(`✗ ${message}`, colors.red);
}

function warning(message) {
  log(`⚠ ${message}`, colors.yellow);
}

function info(message) {
  log(`ℹ ${message}`, colors.cyan);
}

async function question(prompt) {
  return new Promise((resolve) => {
    rl.question(`${colors.cyan}${prompt}${colors.reset} `, resolve);
  });
}

function copyEnvFile(examplePath, targetPath, serviceName) {
  if (fs.existsSync(targetPath)) {
    warning(`${serviceName} .env already exists, skipping...`);
    return false;
  }

  if (!fs.existsSync(examplePath)) {
    error(`${serviceName} .env.example not found at ${examplePath}`);
    return false;
  }

  try {
    const content = fs.readFileSync(examplePath, 'utf8');
    fs.writeFileSync(targetPath, content);
    success(`Created ${serviceName} .env file`);
    return true;
  } catch (err) {
    error(`Failed to create ${serviceName} .env: ${err.message}`);
    return false;
  }
}

function displayWelcome() {
  console.clear();
  log(`${colors.bright}${colors.cyan}
╔═══════════════════════════════════════════════════╗
║                                                   ║
║        Welcome to Wizard Tracker Setup!          ║
║                                                   ║
║  This wizard will help you set up the project    ║
║  for the first time.                             ║
║                                                   ║
╚═══════════════════════════════════════════════════╝
${colors.reset}`);
}

async function checkPrerequisites() {
  header('Checking Prerequisites');
  
  // Check Node version
  const nodeVersion = process.version;
  const [major] = nodeVersion.substring(1).split('.').map(Number);
  
  if (major >= 18) {
    success(`Node.js ${nodeVersion} (✓ >= 18.0.0)`);
  } else {
    error(`Node.js ${nodeVersion} (✗ Required: >= 18.0.0)`);
    error('Please upgrade Node.js: https://nodejs.org/');
    return false;
  }
  
  return true;
}

async function setupEnvironmentFiles() {
  header('Setting Up Environment Files');
  
  const rootExample = path.join(__dirname, '..', '.env.example');
  const rootTarget = path.join(__dirname, '..', '.env');
  const backendExample = path.join(__dirname, '..', 'backend', '.env.example');
  const backendTarget = path.join(__dirname, '..', 'backend', '.env');
  
  copyEnvFile(rootExample, rootTarget, 'Root');
  copyEnvFile(backendExample, backendTarget, 'Backend');
  
  console.log();
  info('Environment files created from templates');
  info('You can customize them later in .env and backend/.env');
}

async function chooseDeploymentMethod() {
  header('Choose Deployment Method');
  
  console.log('\nHow would you like to run Wizard Tracker?\n');
  console.log('  1. Docker (Recommended) - Easiest setup, includes MongoDB');
  console.log('  2. Manual - Run MongoDB, backend, and frontend separately');
  console.log('  3. Skip - I\'ll decide later\n');
  
  const choice = await question('Enter your choice (1-3): ');
  
  switch (choice.trim()) {
    case '1':
      return 'docker';
    case '2':
      return 'manual';
    case '3':
    default:
      return 'skip';
  }
}

function displayDockerInstructions() {
  header('Docker Setup Instructions');
  
  console.log('\nNext steps for Docker deployment:\n');
  console.log('  1. Make sure Docker Desktop is running');
  console.log('  2. Generate secure secrets:');
  log('     npm run setup-env', colors.cyan);
  console.log('  3. Start all services:');
  log('     npm start', colors.cyan);
  console.log('  4. View logs:');
  log('     npm run logs', colors.cyan);
  console.log('  5. Stop services:');
  log('     npm stop', colors.cyan);
  
  console.log('\nThe application will be available at:');
  log('  • Frontend:      http://localhost:8088', colors.green);
  log('  • Backend API:   http://localhost:3000', colors.green);
  log('  • Mongo Express: http://localhost:8081', colors.green);
}

function displayManualInstructions() {
  header('Manual Setup Instructions');
  
  console.log('\nNext steps for manual deployment:\n');
  console.log('  1. Install MongoDB locally or use MongoDB Atlas');
  console.log('  2. Update backend/.env with your MongoDB connection string');
  console.log('  3. Install dependencies:');
  log('     npm run install:all', colors.cyan);
  console.log('  4. Generate secure secrets:');
  log('     npm run setup-env', colors.cyan);
  console.log('  5. Start backend (in one terminal):');
  log('     cd backend && npm start', colors.cyan);
  console.log('  6. Start frontend (in another terminal):');
  log('     cd frontend && npm run dev', colors.cyan);
  
  console.log('\nThe application will be available at:');
  log('  • Frontend:    http://localhost:5173 (Vite dev server)', colors.green);
  log('  • Backend API: http://localhost:3000', colors.green);
}

function displaySkipInstructions() {
  header('Setup Complete');
  
  console.log('\nEnvironment files have been created.');
  console.log('\nWhen you\'re ready, you can:');
  console.log('  • Run setup verification:');
  log('     npm run verify', colors.cyan);
  console.log('  • Generate secure secrets:');
  log('     npm run setup-env', colors.cyan);
  console.log('  • Start with Docker:');
  log('     npm start', colors.cyan);
  console.log('  • Or install dependencies for manual setup:');
  log('     npm run install:all', colors.cyan);
}

async function offerToRunSetupEnv() {
  console.log();
  const answer = await question('Would you like to generate secure JWT secrets now? (y/N): ');
  
  if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
    console.log();
    info('Running npm run setup-env...');
    
    const { spawn } = require('child_process');
    
    return new Promise((resolve) => {
      const proc = spawn('npm', ['run', 'setup-env'], {
        stdio: 'inherit',
        shell: true,
      });
      
      proc.on('close', (code) => {
        if (code === 0) {
          success('Secrets generated successfully!');
        } else {
          error('Failed to generate secrets. Run manually: npm run setup-env');
        }
        resolve();
      });
    });
  }
}

async function offerToRunVerify() {
  console.log();
  const answer = await question('Would you like to verify your setup now? (y/N): ');
  
  if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
    console.log();
    info('Running npm run verify...');
    
    const { spawn } = require('child_process');
    
    return new Promise((resolve) => {
      const proc = spawn('npm', ['run', 'verify'], {
        stdio: 'inherit',
        shell: true,
      });
      
      proc.on('close', () => {
        resolve();
      });
    });
  }
}

function displayFinalMessage() {
  console.log(`\n${colors.bright}${colors.green}
╔═══════════════════════════════════════════════════╗
║                                                   ║
║           Setup Complete! 🎉                      ║
║                                                   ║
║  Your Wizard Tracker project is ready to go!     ║
║                                                   ║
╚═══════════════════════════════════════════════════╝
${colors.reset}`);
  
  console.log('\nUseful commands:\n');
  log('  npm run verify', colors.cyan);
  console.log('    → Verify your setup\n');
  log('  npm start', colors.cyan);
  console.log('    → Start the application with Docker\n');
  log('  npm run logs', colors.cyan);
  console.log('    → View application logs\n');
  log('  npm stop', colors.cyan);
  console.log('    → Stop the application\n');
  
  console.log('📚 Documentation:');
  console.log('  • README.md        - Project overview');
  console.log('  • SETUP.md         - Detailed setup guide');
  console.log('  • DEVELOPMENT.md   - Development guidelines');
  console.log('  • ARCHITECTURE.md  - Technical architecture');
  
  console.log('\n💡 Need help? Check the documentation or open an issue:');
  log('   https://github.com/jkrumboe/wizard-tracker/issues\n', colors.cyan);
}

async function main() {
  try {
    displayWelcome();
    
    const prereqsOk = await checkPrerequisites();
    if (!prereqsOk) {
      process.exit(1);
    }
    
    await setupEnvironmentFiles();
    
    const deploymentMethod = await chooseDeploymentMethod();
    
    console.log();
    
    switch (deploymentMethod) {
      case 'docker':
        displayDockerInstructions();
        await offerToRunSetupEnv();
        break;
      case 'manual':
        displayManualInstructions();
        await offerToRunSetupEnv();
        break;
      case 'skip':
        displaySkipInstructions();
        break;
    }
    
    await offerToRunVerify();
    
    displayFinalMessage();
    
    rl.close();
  } catch (error) {
    error(`\nSetup failed: ${error.message}`);
    rl.close();
    process.exit(1);
  }
}

// Run initialization
main();
