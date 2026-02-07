#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Build script to prepare providers for distribution
console.log('🔨 Building Nuvio providers...');

const srcDir = path.join(__dirname, 'src', 'providers');
const outputDir = path.join(__dirname, 'providers');

// Create output directory if it doesn't exist
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Copy all provider files
const files = fs.readdirSync(srcDir);
let copiedCount = 0;

files.forEach(file => {
  if (file.endsWith('.js')) {
    const src = path.join(srcDir, file);
    const dest = path.join(outputDir, file);
    fs.copyFileSync(src, dest);
    console.log(`✓ ${file}`);
    copiedCount++;
  }
});

console.log(`\n✅ Build complete! ${copiedCount} provider(s) processed.`);
