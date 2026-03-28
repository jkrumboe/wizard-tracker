#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import process from 'process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.join(__dirname, '..', 'dist');
const swPath = path.join(distDir, 'service-worker.js');
const indexPath = path.join(distDir, 'index.html');

function collectUrlsFromServiceWorker(content) {
  const urls = new Set();
  const patterns = [/url":"([^"?#]+)(?:\?[^"#]*)?"/g, /url:\s*"([^"?#]+)(?:\?[^"#]*)?"/g];

  patterns.forEach((pattern) => {
    let match = pattern.exec(content);
    while (match) {
      urls.add(match[1]);
      match = pattern.exec(content);
    }
  });

  return [...urls];
}

function collectAssetUrlsFromIndex(content) {
  const urls = new Set();
  const pattern = /(?:src|href)="(\/assets\/[^"?#]+)(?:\?[^"#]*)?"/g;
  let match = pattern.exec(content);
  while (match) {
    urls.add(match[1]);
    match = pattern.exec(content);
  }
  return [...urls];
}

function toDistPath(urlPath) {
  const normalized = urlPath.startsWith('/') ? urlPath.slice(1) : urlPath;
  return path.join(distDir, normalized);
}

if (!fs.existsSync(distDir)) {
  console.error('❌ dist directory not found. Run build before integrity verification.');
  process.exit(1);
}

if (!fs.existsSync(swPath) || !fs.existsSync(indexPath)) {
  console.error('❌ Missing build outputs. Expected dist/service-worker.js and dist/index.html.');
  process.exit(1);
}

const swContent = fs.readFileSync(swPath, 'utf-8');
const indexContent = fs.readFileSync(indexPath, 'utf-8');

const swUrls = collectUrlsFromServiceWorker(swContent);
const indexAssetUrls = collectAssetUrlsFromIndex(indexContent);
const urlsToCheck = [...new Set([...swUrls, ...indexAssetUrls])];

const missing = urlsToCheck.filter((urlPath) => !fs.existsSync(toDistPath(urlPath)));

if (missing.length > 0) {
  console.error('❌ Build integrity check failed. Missing files referenced by dist artifacts:');
  missing.forEach((item) => console.error(`   - ${item}`));
  process.exit(1);
}

console.log(`✓ Build integrity OK. Checked ${urlsToCheck.length} referenced files.`);
