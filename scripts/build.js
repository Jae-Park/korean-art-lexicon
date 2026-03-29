#!/usr/bin/env node

/**
 * Build script: reads all YAML data files and produces dist/lexicon.json
 * Usage: node scripts/build.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');
const distDir = path.join(rootDir, 'dist');

const categories = [
  { key: 'persons', dir: 'data/persons' },
  { key: 'exhibitions', dir: 'data/exhibitions' },
  { key: 'organizations', dir: 'data/organizations' },
  { key: 'terms', dir: 'data/terms' },
];

const lexicon = {};

for (const { key, dir } of categories) {
  const fullDir = path.join(rootDir, dir);
  if (!fs.existsSync(fullDir)) {
    lexicon[key] = [];
    continue;
  }

  const files = fs.readdirSync(fullDir).filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
  lexicon[key] = files.map(f => {
    const content = fs.readFileSync(path.join(fullDir, f), 'utf8');
    return yaml.load(content);
  });
}

if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

const outPath = path.join(distDir, 'lexicon.json');
fs.writeFileSync(outPath, JSON.stringify(lexicon, null, 2), 'utf8');

const counts = Object.entries(lexicon).map(([k, v]) => `${k}: ${v.length}`).join(', ');
console.log(`Built dist/lexicon.json (${counts})`);
