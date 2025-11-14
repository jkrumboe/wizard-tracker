#!/usr/bin/env node

/**
 * Health Check Script
 * Verifies that all services are running and responding correctly
 */

const http = require('http');
const https = require('https');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, type = 'info') {
  const icons = {
    success: `${colors.green}✓${colors.reset}`,
    error: `${colors.red}✗${colors.reset}`,
    warning: `${colors.yellow}⚠${colors.reset}`,
    info: `${colors.cyan}ℹ${colors.reset}`,
  };
  console.log(`${icons[type]} ${message}`);
}

function header(message) {
  console.log(`\n${colors.bright}${colors.blue}${message}${colors.reset}`);
  console.log('='.repeat(message.length));
}

async function checkEndpoint(url, name, expectedStatus = 200) {
  return new Promise((resolve) => {
    const protocol = url.startsWith('https') ? https : http;
    
    const startTime = Date.now();
    const req = protocol.get(url, (res) => {
      const responseTime = Date.now() - startTime;
      
      if (res.statusCode === expectedStatus) {
        log(`${name} is healthy (${responseTime}ms)`, 'success');
        resolve(true);
      } else {
        log(`${name} returned status ${res.statusCode} (expected ${expectedStatus})`, 'error');
        resolve(false);
      }
    });
    
    req.on('error', (error) => {
      log(`${name} is not responding: ${error.message}`, 'error');
      resolve(false);
    });
    
    req.setTimeout(5000, () => {
      req.destroy();
      log(`${name} request timed out`, 'error');
      resolve(false);
    });
  });
}

async function main() {
  console.log(`${colors.bright}${colors.cyan}Wizard Tracker Health Check${colors.reset}\n`);
  
  header('Checking Services');
  
  const checks = [
    { url: 'http://localhost:8088', name: 'Frontend', status: 200 },
    { url: 'http://localhost:3000/api/health', name: 'Backend API', status: 200 },
    { url: 'http://localhost:8081', name: 'Mongo Express', status: 200 },
  ];
  
  const results = await Promise.all(
    checks.map(({ url, name, status }) => checkEndpoint(url, name, status))
  );
  
  const allHealthy = results.every(Boolean);
  
  header('Summary');
  
  if (allHealthy) {
    log('All services are healthy! ✨', 'success');
    console.log('\nAccess URLs:');
    console.log(`  • Frontend:      ${colors.cyan}http://localhost:8088${colors.reset}`);
    console.log(`  • Backend API:   ${colors.cyan}http://localhost:3000${colors.reset}`);
    console.log(`  • Mongo Express: ${colors.cyan}http://localhost:8081${colors.reset}`);
    process.exit(0);
  } else {
    log('Some services are not healthy', 'error');
    console.log('\nTroubleshooting:');
    console.log('  • Check if containers are running: docker ps');
    console.log('  • View logs:                        npm run logs');
    console.log('  • Restart services:                 npm restart');
    process.exit(1);
  }
}

main();
