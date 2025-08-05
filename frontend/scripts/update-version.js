#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import process from 'process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read version from .env file
function getVersionFromEnv() {
  const envPath = path.join(__dirname, '../.env');
  try {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const versionMatch = envContent.match(/VITE_APP_VERSION\s*=\s*"([^"]+)"/);
    return versionMatch ? versionMatch[1] : null;
  } catch (error) {
    console.error('Error reading .env file:', error);
    return null;
  }
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

// Main function
function main() {
  const version = getVersionFromEnv();
  
  if (!version) {
    console.error('❌ Could not find VITE_APP_VERSION in .env file');
    process.exit(1);
  }

  console.log(`🔄 Updating all version references to ${version}...`);
  
  updateServiceWorkerVersion(version);
  updateReadmeBadge(version);
  
  console.log(`✅ Version update complete! All files now use version ${version}`);
}

main();
