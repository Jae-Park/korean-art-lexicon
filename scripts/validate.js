#!/usr/bin/env node

/**
 * Validate all YAML data files against JSON schemas
 * Usage: node scripts/validate.js
 */

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');

// Initialize AJV
const ajv = new Ajv({ allErrors: true, strict: true });
addFormats(ajv);

// Entity type configurations
const entityTypes = [
  {
    name: 'persons',
    dir: 'data/persons',
    schemaFile: 'schema/person.schema.json',
    idPrefix: 'person'
  },
  {
    name: 'exhibitions',
    dir: 'data/exhibitions',
    schemaFile: 'schema/exhibition.schema.json',
    idPrefix: 'exhibition'
  },
  {
    name: 'organizations',
    dir: 'data/organizations',
    schemaFile: 'schema/organization.schema.json',
    idPrefix: 'org'
  },
  {
    name: 'terms',
    dir: 'data/terms',
    schemaFile: 'schema/term.schema.json',
    idPrefix: 'term'
  },
  {
    name: 'publications',
    dir: 'data/publications',
    schemaFile: 'schema/publication.schema.json',
    idPrefix: 'publication'
  }
];

// Track results
let hasErrors = false;
const results = {};

// Load schemas and initialize validators
const validators = {};
for (const entity of entityTypes) {
  const schemaPath = path.join(rootDir, entity.schemaFile);
  if (fs.existsSync(schemaPath)) {
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
    validators[entity.name] = ajv.compile(schema);
    results[entity.name] = { valid: 0, invalid: 0, errors: [] };
  }
}

/**
 * Validate all YAML files in a directory
 */
function validateDirectory(dirPath, validator, category, idPrefix) {
  if (!fs.existsSync(dirPath)) return;

  const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));

  for (const file of files) {
    const filePath = path.join(dirPath, file);
    try {
      const content = yaml.load(fs.readFileSync(filePath, 'utf8'));

      // Check if id matches filename
      const expectedId = `${idPrefix}.${path.basename(file, path.extname(file))}`;
      if (content.id !== expectedId) {
        results[category].invalid++;
        results[category].errors.push({
          file,
          errors: [`ID mismatch: expected "${expectedId}", got "${content.id}"`]
        });
        hasErrors = true;
        continue;
      }

      const valid = validator(content);
      if (valid) {
        results[category].valid++;
      } else {
        results[category].invalid++;
        results[category].errors.push({
          file,
          errors: validator.errors.map(e => `${e.instancePath} ${e.message}`)
        });
        hasErrors = true;
      }
    } catch (e) {
      results[category].invalid++;
      results[category].errors.push({
        file,
        errors: [`YAML parse error: ${e.message}`]
      });
      hasErrors = true;
    }
  }
}

// Run validation
console.log('Validating Korean Art Lexicon data...\n');

for (const entity of entityTypes) {
  if (validators[entity.name]) {
    validateDirectory(
      path.join(rootDir, entity.dir),
      validators[entity.name],
      entity.name,
      entity.idPrefix
    );
  }
}

// Print results
for (const entity of entityTypes) {
  if (!results[entity.name]) continue;

  const r = results[entity.name];
  const title = entity.name.charAt(0).toUpperCase() + entity.name.slice(1);

  console.log(`=== ${title} ===`);
  console.log(`  Valid: ${r.valid}`);
  console.log(`  Invalid: ${r.invalid}`);

  for (const err of r.errors) {
    console.log(`  ❌ ${err.file}`);
    for (const e of err.errors) {
      console.log(`     - ${e}`);
    }
  }
  console.log('');
}

console.log(hasErrors ? '❌ Validation failed' : '✅ All files valid');
process.exit(hasErrors ? 1 : 0);
