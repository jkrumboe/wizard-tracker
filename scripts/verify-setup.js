#!/usr/bin/env node

/**
 * Setup Verification Script
 * Validates that all prerequisites are met for running Wizard Tracker
 * Checks Node version, Docker, MongoDB, ports, and environment configuration
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');
const net = require('net');

const execAsync = promisify(exec);

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

const icons = {
  success: '✓',
  error: '✗',
  warning: '⚠',
  info: 'ℹ',
};

let hasErrors = false;
let hasWarnings = false;

function log(message, type = 'info') {
  const prefix = {
    success: `${colors.green}${icons.success}${colors.reset}`,
    error: `${colors.red}${icons.error}${colors.reset}`,
    warning: `${colors.yellow}${icons.warning}${colors.reset}`,
    info: `${colors.cyan}${icons.info}${colors.reset}`,
  };
  console.log(`${prefix[type]} ${message}`);
}

function header(message) {
  console.log(`\n${colors.bright}${colors.blue}${message}${colors.reset}`);
  console.log('='.repeat(message.length));
}

async function checkNodeVersion() {
  header('Checking Node.js Version');
  
  try {
    const requiredVersion = '18.0.0';
    const currentVersion = process.version.substring(1); // Remove 'v' prefix
    
    const [reqMajor, reqMinor] = requiredVersion.split('.').map(Number);
    const [curMajor, curMinor] = currentVersion.split('.').map(Number);
    
    if (curMajor > reqMajor || (curMajor === reqMajor && curMinor >= reqMinor)) {
      log(`Node.js ${process.version} (required: >= ${requiredVersion})`, 'success');
      return true;
    } else {
      log(`Node.js ${process.version} is below required version ${requiredVersion}`, 'error');
      hasErrors = true;
      return false;
    }
  } catch (error) {
    log(`Error checking Node version: ${error.message}`, 'error');
    hasErrors = true;
    return false;
  }
}

async function checkNpm() {
  header('Checking npm');
  
  try {
    const { stdout } = await execAsync('npm --version');
    const version = stdout.trim();
    log(`npm ${version} installed`, 'success');
    return true;
  } catch (error) {
    log('npm is not installed or not in PATH', 'error');
    hasErrors = true;
    return false;
  }
}

async function checkDocker() {
  header('Checking Docker');
  
  try {
    const { stdout } = await execAsync('docker --version');
    const version = stdout.trim();
    log(`${version}`, 'success');
    
    // Check if Docker daemon is running
    try {
      await execAsync('docker ps');
      log('Docker daemon is running', 'success');
      return true;
    } catch (error) {
      log('Docker is installed but daemon is not running', 'warning');
      log('Start Docker Desktop or Docker daemon to use containerized deployment', 'info');
      hasWarnings = true;
      return false;
    }
  } catch (error) {
    log('Docker is not installed or not in PATH', 'warning');
    log('Docker is optional - you can run manually with Node.js and MongoDB', 'info');
    hasWarnings = true;
    return false;
  }
}

async function checkDockerCompose() {
  header('Checking Docker Compose');
  
  try {
    const { stdout } = await execAsync('docker compose version');
    const version = stdout.trim();
    log(`${version}`, 'success');
    return true;
  } catch (error) {
    log('Docker Compose is not available', 'warning');
    log('Install Docker Compose for containerized deployment', 'info');
    hasWarnings = true;
    return false;
  }
}

async function checkEnvironmentFiles() {
  header('Checking Environment Files');
  
  const rootEnv = path.join(__dirname, '..', '.env');
  const backendEnv = path.join(__dirname, '..', 'backend', '.env');
  
  let allPresent = true;
  
  // Check root .env
  if (fs.existsSync(rootEnv)) {
    log('Root .env file exists', 'success');
    
    // Validate JWT_SECRET
    const content = fs.readFileSync(rootEnv, 'utf8');
    if (content.includes('JWT_SECRET=') && !content.includes('JWT_SECRET=your-secret-key-here')) {
      log('JWT_SECRET is configured', 'success');
    } else {
      log('JWT_SECRET needs to be set (run: npm run setup-env)', 'warning');
      hasWarnings = true;
    }
  } else {
    log('Root .env file missing (copy from .env.example)', 'error');
    hasErrors = true;
    allPresent = false;
  }
  
  // Check backend .env
  if (fs.existsSync(backendEnv)) {
    log('Backend .env file exists', 'success');
  } else {
    log('Backend .env file missing (copy from backend/.env.example)', 'warning');
    hasWarnings = true;
  }
  
  return allPresent;
}

async function checkPort(port, service) {
  return new Promise((resolve) => {
    const server = net.createServer();
    
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve(false); // Port in use
      } else {
        resolve(true); // Other error, assume available
      }
    });
    
    server.once('listening', () => {
      server.close();
      resolve(true); // Port available
    });
    
    server.listen(port);
  });
}

async function checkPorts() {
  header('Checking Port Availability');
  
  const ports = [
    { port: 8088, service: 'Frontend' },
    { port: 3000, service: 'Backend API' },
    { port: 27017, service: 'MongoDB' },
    { port: 8081, service: 'Mongo Express' },
  ];
  
  let allAvailable = true;
  
  for (const { port, service } of ports) {
    const available = await checkPort(port, service);
    if (available) {
      log(`Port ${port} (${service}) is available`, 'success');
    } else {
      log(`Port ${port} (${service}) is in use`, 'warning');
      log(`  If containers are already running, this is expected`, 'info');
      hasWarnings = true;
      allAvailable = false;
    }
  }
  
  return allAvailable;
}

async function checkDependencies() {
  header('Checking Dependencies');
  
  const locations = [
    { path: path.join(__dirname, '..', 'node_modules'), name: 'Root' },
    { path: path.join(__dirname, '..', 'backend', 'node_modules'), name: 'Backend' },
    { path: path.join(__dirname, '..', 'frontend', 'node_modules'), name: 'Frontend' },
  ];
  
  let allInstalled = true;
  
  for (const { path: modPath, name } of locations) {
    if (fs.existsSync(modPath)) {
      log(`${name} dependencies installed`, 'success');
    } else {
      log(`${name} dependencies not installed (run: npm run install:all)`, 'warning');
      hasWarnings = true;
      allInstalled = false;
    }
  }
  
  return allInstalled;
}

async function checkMongoDBConnection() {
  header('Checking MongoDB Connection');
  
  try {
    // Try to connect to MongoDB (if running)
    const { stdout } = await execAsync('docker ps --filter "name=mongo" --format "{{.Names}}"');
    if (stdout.trim()) {
      log('MongoDB container is running', 'success');
      return true;
    } else {
      log('MongoDB container is not running', 'info');
      log('Start containers with: npm start', 'info');
      return false;
    }
  } catch (error) {
    log('Cannot check MongoDB status (Docker not available)', 'info');
    return false;
  }
}

async function checkGit() {
  header('Checking Git');
  
  try {
    const { stdout } = await execAsync('git --version');
    const version = stdout.trim();
    log(`${version}`, 'success');
    
    // Check if in a git repository
    const gitDir = path.join(__dirname, '..', '.git');
    if (fs.existsSync(gitDir)) {
      log('Git repository initialized', 'success');
    }
    
    return true;
  } catch (error) {
    log('Git is not installed or not in PATH', 'warning');
    log('Git is recommended for version control', 'info');
    hasWarnings = true;
    return false;
  }
}

async function printSummary() {
  header('Summary');
  
  if (!hasErrors && !hasWarnings) {
    log('All checks passed! ✨', 'success');
    console.log(`\n${colors.green}${colors.bright}You're ready to go!${colors.reset}`);
    console.log('\nNext steps:');
    console.log('  1. Start the application:  npm start');
    console.log('  2. View logs:              npm run logs');
    console.log('  3. Stop the application:   npm stop');
    console.log('\nAccess the application at: http://localhost:8088');
  } else if (hasErrors) {
    log('Setup verification failed with errors', 'error');
    console.log(`\n${colors.red}${colors.bright}Please fix the errors above before continuing${colors.reset}`);
    console.log('\nCommon fixes:');
    console.log('  • Update Node.js:       https://nodejs.org/');
    console.log('  • Create .env file:     npm run init');
    console.log('  • Install dependencies: npm run install:all');
    process.exit(1);
  } else {
    log('Setup verification completed with warnings', 'warning');
    console.log(`\n${colors.yellow}${colors.bright}You can proceed, but some features may not work${colors.reset}`);
    console.log('\nRecommended actions:');
    console.log('  • Install Docker:       https://www.docker.com/get-started');
    console.log('  • Run setup:            npm run setup');
    console.log('  • Install dependencies: npm run install:all');
  }
}

async function main() {
  console.log(`${colors.bright}${colors.cyan}`);
  console.log('╔═══════════════════════════════════════════╗');
  console.log('║   Wizard Tracker Setup Verification      ║');
  console.log('╚═══════════════════════════════════════════╝');
  console.log(colors.reset);
  
  await checkNodeVersion();
  await checkNpm();
  await checkGit();
  await checkDocker();
  await checkDockerCompose();
  await checkEnvironmentFiles();
  await checkDependencies();
  await checkPorts();
  await checkMongoDBConnection();
  
  await printSummary();
}

// Run verification
main().catch((error) => {
  console.error(`${colors.red}Unexpected error:${colors.reset}`, error);
  process.exit(1);
});
