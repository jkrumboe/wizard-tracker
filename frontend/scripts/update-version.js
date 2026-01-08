#!/usr/bin/env node

/**
 * Update Version Script
 * 
 * This script updates the version number across all important files in the project:
 * - All package.json files (root, frontend, backend)
 * - .env file (VITE_APP_VERSION)
 * - Service worker files (cache names)
 * - README.md version badge
 * - Docker workflow files
 * - docker-compose.yml
 * 
 * Usage:
 *   npm run update-version
 * 
 * The version is read from .env or VITE_APP_VERSION environment variable
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import process from 'process';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read version from .env file or environment variables
function getVersion() {
  // First try to get from environment variable (Docker build)
  if (process.env.VITE_APP_VERSION) {
    return process.env.VITE_APP_VERSION;
  }

  // Fallback to reading from .env file (local development)
  const envPath = path.join(__dirname, '../../.env'); // Look in root directory
  try {
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      // Updated regex to handle both quoted and unquoted values
      const versionMatch = envContent.match(/VITE_APP_VERSION\s*=\s*"?([^"\s]+)"?/);
      return versionMatch ? versionMatch[1] : null;
    }
  } catch (error) {
    console.warn('Warning: Could not read .env file:', error.message);
  }

  return null;
}

// Update service worker files with the version
function updateServiceWorkerVersion(version) {
  const files = [
    path.join(__dirname, '../src/service-worker.js'),
    path.join(__dirname, '../public/service-worker.js')
  ];

  files.forEach(filePath => {
    try {
      if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, 'utf8');
        content = content.replace(
          /const CACHE_NAME = "keep-wiz-v[^"]+"/,
          `const CACHE_NAME = "keep-wiz-v${version}"`
        );
        fs.writeFileSync(filePath, content);
        console.debug(`✅ Updated version in ${path.basename(filePath)} to ${version}`);
      }
    } catch (error) {
      console.error(`Error updating ${filePath}:`, error);
    }
  });
}

// Update README.md badge
function updateReadmeBadge(version) {
  const readmePath = path.join(__dirname, '../../README.md');
  try {
    if (fs.existsSync(readmePath)) {
      let content = fs.readFileSync(readmePath, 'utf8');
      content = content.replace(
        /!\[Version\]\(https:\/\/img\.shields\.io\/badge\/version-[^-]+-blue\)/,
        `![Version](https://img.shields.io/badge/version-${version}-blue)`
      );
      fs.writeFileSync(readmePath, content);
      console.debug(`✅ Updated version badge in README.md to ${version}`);
    }
  } catch (error) {
    console.error('Error updating README.md:', error);
  }
}

// Update Docker workflow file
function updateDockerWorkflow(version) {
  const workflowPath = path.join(__dirname, '../../.github/workflows/docker-build.yml');
  try {
    if (fs.existsSync(workflowPath)) {
      let content = fs.readFileSync(workflowPath, 'utf8');
      
      // Update the env section version (with quotes)
      content = content.replace(
        /VITE_APP_VERSION:\s*"[^"]+"/,
        `VITE_APP_VERSION: "${version}"`
      );
      
      // Update the build-args section version (without quotes)
      content = content.replace(
        /VITE_APP_VERSION=[^\s\n]+/,
        `VITE_APP_VERSION=${version}`
      );
      
      fs.writeFileSync(workflowPath, content);
      console.debug(`✅ Updated version in docker-build.yml to ${version}`);
    }
  } catch (error) {
    console.error('Error updating docker-build.yml:', error);
  }
}

// Update package.json files
function updatePackageJsonFiles(version) {
  const packageFiles = [
    path.join(__dirname, '../../package.json'),        // Root package.json
    path.join(__dirname, '../package.json'),           // Frontend package.json
    path.join(__dirname, '../../backend/package.json') // Backend package.json
  ];

  packageFiles.forEach(filePath => {
    try {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        const packageJson = JSON.parse(content);
        packageJson.version = version;
        fs.writeFileSync(filePath, JSON.stringify(packageJson, null, 2) + '\n');
        const relativePath = path.relative(path.join(__dirname, '../..'), filePath);
        console.debug(`✅ Updated version in ${relativePath} to ${version}`);
      }
    } catch (error) {
      console.error(`Error updating ${filePath}:`, error);
    }
  });
}

// Update docker-compose.yml
function updateDockerCompose(version) {
  const composePath = path.join(__dirname, '../../docker-compose.yml');
  try {
    if (fs.existsSync(composePath)) {
      let content = fs.readFileSync(composePath, 'utf8');
      content = content.replace(
        /VITE_APP_VERSION:\s*\$\{VITE_APP_VERSION:-[^}]+\}/,
        `VITE_APP_VERSION: \${VITE_APP_VERSION:-${version}}`
      );
      fs.writeFileSync(composePath, content);
      console.debug(`✅ Updated version in docker-compose.yml to ${version}`);
    }
  } catch (error) {
    console.error('Error updating docker-compose.yml:', error);
  }
}

// Update .env file
function updateEnvFile(version) {
  const envPath = path.join(__dirname, '../../.env');
  try {
    if (fs.existsSync(envPath)) {
      let content = fs.readFileSync(envPath, 'utf8');
      content = content.replace(
        /VITE_APP_VERSION\s*=\s*"?[^"\s]+"?/,
        `VITE_APP_VERSION=${version}`
      );
      fs.writeFileSync(envPath, content);
      console.debug(`✅ Updated version in .env to ${version}`);
    }
  } catch (error) {
    console.error('Error updating .env:', error);
  }
}

// Generate a random hex string
function generateRandomHex(length) {
  return crypto.randomBytes(length).toString('hex');
}

// Generate a secure random password
// eslint-disable-next-line no-unused-vars
function generateRandomPassword(length = 24) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  const passwordChars = [];
  const charLen = chars.length;
  const maxByte = 256 - (256 % charLen); // Upper bound for unbiased selection
  while (passwordChars.length < length) {
    const buf = crypto.randomBytes(1);
    const byte = buf[0];
    if (byte < maxByte) {
      passwordChars.push(chars[byte % charLen]);
    }
    // else discard this byte and try again
  }
  return passwordChars.join('');
}

// Update .creds file with new randomly generated security credentials
function updateCredsFile(version) {
  const credsPath = path.join(__dirname, '../../.creds');
  
  try {
    // Generate new random credentials
    const jwtSecret = generateRandomHex(64); // 128 character hex string
    const mongoUser = 'admin';
    const mongoPass = `WizardTracker${new Date().getFullYear()}!${generateRandomHex(8)}`;

    // Create .creds content
    const credsContent = `# Security Credentials for Wizard Tracker v${version}
# Generated: ${new Date().toISOString()}
# DO NOT commit this file to version control!

# JWT Secret Key (used for authentication tokens)
JWT_SECRET=${jwtSecret}

# MongoDB Admin Interface Credentials
ME_CONFIG_BASICAUTH_USERNAME=${mongoUser}
ME_CONFIG_BASICAUTH_PASSWORD=${mongoPass}
`;

    fs.writeFileSync(credsPath, credsContent);
    console.debug(`✅ Generated new security credentials in .creds for version ${version}`);
  } catch (error) {
    console.error('Error updating .creds:', error);
  }
}

// Main function
function main() {
  let version = getVersion();
  
  if (!version) {
    // Use package.json version as ultimate fallback
    try {
      const packagePath = path.join(__dirname, '../package.json');
      const packageContent = fs.readFileSync(packagePath, 'utf8');
      const packageJson = JSON.parse(packageContent);
      version = packageJson.version;
      console.warn(`⚠️  Using package.json version as fallback: ${version}`);
    } catch {
      console.error('❌ Could not determine version from any source');
      process.exit(1);
    }
  }

  console.debug(`🔄 Updating all version references to ${version}...`);
  
  updatePackageJsonFiles(version);
  updateEnvFile(version);
  updateCredsFile(version);
  updateServiceWorkerVersion(version);
  updateReadmeBadge(version);
  updateDockerWorkflow(version);
  updateDockerCompose(version);
  
  console.debug(`\n✅ Version update complete! All files now use version ${version}`);
}

main();
