#!/usr/bin/env node

/**
 * Build script: reads all YAML data files and produces dist/lexicon.json
 * Usage: node scripts/build.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';
import yaml from 'js-yaml';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');
const dataDir = path.join(rootDir, 'data');
const distDir = path.join(rootDir, 'dist');

const categories = [
  { key: 'persons', dir: 'data/persons' },
  { key: 'exhibitions', dir: 'data/exhibitions' },
  { key: 'organizations', dir: 'data/organizations' },
  { key: 'terms', dir: 'data/terms' },
  { key: 'publications', dir: 'data/publications' },
];

const lexicon = {};

function gitLastModified(filePath) {
  try {
    const output = execFileSync(
      'git',
      ['log', '-1', '--format=%aI', '--', filePath],
      { cwd: rootDir, encoding: 'utf8' }
    ).trim();
    return output ? output.slice(0, 10) : null;
  } catch {
    return null;
  }
}

for (const { key, dir } of categories) {
  const fullDir = path.join(rootDir, dir);
  if (!fs.existsSync(fullDir)) {
    lexicon[key] = [];
    continue;
  }

  const files = fs
    .readdirSync(fullDir)
    .filter(f => f.endsWith('.yaml') || f.endsWith('.yml'))
    .sort();
  lexicon[key] = files.map(f => {
    const filePath = path.join(fullDir, f);
    const content = fs.readFileSync(filePath, 'utf8');
    const doc = yaml.load(content);
    const lastModified = gitLastModified(path.relative(rootDir, filePath));
    if (doc && lastModified) {
      doc._last_updated = lastModified;
    }
    return doc;
  });
}

if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

const outPath = path.join(distDir, 'lexicon.json');
fs.writeFileSync(outPath, JSON.stringify(lexicon, null, 2), 'utf8');

const counts = Object.entries(lexicon).map(([k, v]) => `${k}: ${v.length}`).join(', ');
console.log(`Built dist/lexicon.json (${counts})`);
