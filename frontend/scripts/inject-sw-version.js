#!/usr/bin/env node
/**
 * Script to inject version into service worker after build
 * This runs as part of the build process to ensure the service worker
 * has the correct version number for cache management
 * 
 * Note: With Vite PWA injectManifest strategy, the service worker is
 * built from public/service-worker.js to dist/service-worker.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import process from 'process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read version from package.json
const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
const APP_VERSION = packageJson.version;

// Path to the built service worker (output by Vite PWA with injectManifest)
const distSwPath = path.join(__dirname, '..', 'dist', 'service-worker.js');

console.log(`Looking for service worker at: ${distSwPath}`);

if (!fs.existsSync(distSwPath)) {
  console.error('❌ Service worker not found at:', distSwPath);
  console.log('   Make sure to run this script after building');
  console.log('   With injectManifest strategy, VitePWA outputs to dist/service-worker.js');
  process.exit(1);
}

// Read service worker content
let swContent = fs.readFileSync(distSwPath, 'utf-8');

// Replace version placeholder
const originalContent = swContent;
swContent = swContent.replace(
  /"__APP_VERSION__"/g,
  `"${APP_VERSION}"`
);

// Check if replacement was made
if (swContent === originalContent) {
  console.warn('⚠️  Version placeholder "__APP_VERSION__" not found in service worker');
  console.log('   Service worker might already have version injected or placeholder format changed');
  console.log('   First 200 chars:', swContent.substring(0, 200));
} else {
  // Write back to file
  fs.writeFileSync(distSwPath, swContent);
  console.log(`✓ Injected version ${APP_VERSION} into service worker at ${distSwPath}`);
}
