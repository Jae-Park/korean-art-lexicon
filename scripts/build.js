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

// --- SEO directory: regenerate the static, crawlable index in index.html from data ---
// Single source of truth = the data. Only public (status !== pending_review) entries are listed.
function escHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
}
function personLi(p) {
  const ko = p.name && p.name.ko && p.name.ko.full || '';
  const hanja = p.name && p.name.ko && p.name.ko.hanja ? ` (${escHtml(p.name.ko.hanja)})` : '';
  const latn = p.name && p.name.latn && p.name.latn.preferred || '';
  const years = p.birth_year ? ` (${p.birth_year}–${p.death_year || ''})` : '';
  return `      <li><a href="#${escHtml(p.id)}">${escHtml(ko)}${hanja} · ${escHtml(latn)}${years}</a></li>`;
}
function titleLi(e) {
  const node = e.name || e.title || e.term || {};
  const ko = node.ko || '';
  const en = node.en || '';
  return `      <li><a href="#${escHtml(e.id)}">${escHtml(ko)}${en ? ' · ' + escHtml(en) : ''}</a></li>`;
}
const dirGroups = [
  { key: 'persons', label: 'People · 인물', li: personLi },
  { key: 'exhibitions', label: 'Exhibitions · 전시', li: titleLi },
  { key: 'organizations', label: 'Institutions · 기관', li: titleLi },
  { key: 'terms', label: 'Terms · 용어', li: titleLi },
  { key: 'publications', label: 'Publications · 출판물', li: titleLi },
];
let dirTotal = 0;
const dirBlocks = dirGroups.map(g => {
  const items = (lexicon[g.key] || [])
    .filter(e => e && e.status !== 'pending_review')
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
  if (!items.length) return null;
  dirTotal += items.length;
  return `    <h3>${g.label} (${items.length})</h3>\n    <ul>\n${items.map(g.li).join('\n')}\n    </ul>`;
}).filter(Boolean);
const indexPath = path.join(rootDir, 'index.html');
if (fs.existsSync(indexPath)) {
  const html = fs.readFileSync(indexPath, 'utf8');
  const START = '<!-- SEO-DIRECTORY:START -->';
  const END = '<!-- SEO-DIRECTORY:END -->';
  const s = html.indexOf(START), e = html.indexOf(END);
  if (s !== -1 && e !== -1 && e > s) {
    const updated = html.slice(0, s + START.length) + '\n' + dirBlocks.join('\n') + '\n    ' + html.slice(e);
    if (updated !== html) {
      fs.writeFileSync(indexPath, updated, 'utf8');
      console.log(`Updated index.html SEO directory (${dirTotal} public entries)`);
    } else {
      console.log('index.html SEO directory unchanged');
    }
  } else {
    console.warn('index.html SEO-DIRECTORY markers not found — skipped');
  }
}
