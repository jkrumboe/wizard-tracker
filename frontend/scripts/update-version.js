#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import process from 'process';

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
        console.log(`✅ Updated version in ${path.basename(filePath)} to ${version}`);
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
      console.log(`✅ Updated version badge in README.md to ${version}`);
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
      console.log(`✅ Updated version in docker-build.yml to ${version}`);
    }
  } catch (error) {
    console.error('Error updating docker-build.yml:', error);
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

  console.log(`🔄 Updating all version references to ${version}...`);
  
  updateServiceWorkerVersion(version);
  updateReadmeBadge(version);
  updateDockerWorkflow(version);
  
  console.log(`✅ Version update complete! All files now use version ${version}`);
}

main();
