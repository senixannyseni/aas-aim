#!/usr/bin/env node
/**
 * AAS–AIM design-token compiler (no runtime dependencies).
 *
 * Input:  design-system/tokens.json   — the only editable design-token source
 * Output: apps/web/src/shared/styles/tokens.generated.css
 *
 * Run:   node scripts/generate-design-tokens.mjs
 * Check: node scripts/generate-design-tokens.mjs --check
 *
 * This script validates token structure, safe CSS values, reference targets,
 * type compatibility, alias cycles, and unique CSS custom-property names.
 * It does not define engineering risk, approval, or evidence truth.
 */
import { createHash } from 'node:crypto';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const input = resolve(root, 'design-system/tokens.json');
const output = resolve(root, 'apps/web/src/shared/styles/tokens.generated.css');
const args = process.argv.slice(2);
if (args.length > 1 || (args.length === 1 && args[0] !== '--check')) {
  console.error('Usage: node scripts/generate-design-tokens.mjs [--check]');
  process.exit(2);
}
const checkOnly = args[0] === '--check';

function fail(message) {
  throw new Error(`Design token error: ${message}`);
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

// Keep case conversion predictable across camelCase, kebab-case, and numerals.
function toCssSegment(segment) {
  if (!/^[A-Za-z0-9_-]+$/.test(segment)) {
    fail(`Invalid token path segment: ${JSON.stringify(segment)}`);
  }
  return segment
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .replace(/_/g, '-')
    .toLowerCase();
}

function varName(path) {
  return `--aim-${path.map(toCssSegment).join('-')}`;
}

function collectTokens(tree) {
  if (!isObject(tree)) fail('The token source must be a JSON object');
  const tokens = new Map();
  const names = new Set();

  function visit(node, path) {
    if (!isObject(node)) fail(`Expected a token group or leaf at ${path.join('.') || '<root>'}`);
    const isLeaf = Object.hasOwn(node, '$type') || Object.hasOwn(node, '$value');
    if (isLeaf) {
      if (!Object.hasOwn(node, '$type') || !Object.hasOwn(node, '$value')) {
        fail(`A token needs both $type and $value: ${path.join('.')}`);
      }
      for (const key of Object.keys(node)) {
        if (!['$type', '$value', '$description'].includes(key)) {
          fail(`Unexpected token property ${key} at ${path.join('.')}`);
        }
      }
      if (path.length === 0) fail('A token must have a path');
      if (typeof node.$type !== 'string') fail(`Invalid $type at ${path.join('.')}`);
      if (!['color', 'dimension', 'fontFamily', 'fontWeight', 'number'].includes(node.$type)) {
        fail(`Unsupported $type ${JSON.stringify(node.$type)} at ${path.join('.')}`);
      }
      const cssName = varName(path);
      if (names.has(cssName)) fail(`CSS variable collision: ${cssName}`);
      names.add(cssName);
      tokens.set(path.join('.'), { ...node, path, cssName });
      return;
    }
    for (const [key, value] of Object.entries(node)) {
      if (key === '$description') continue;
      if (key.startsWith('$')) fail(`Unexpected group property ${key} at ${path.join('.') || '<root>'}`);
      toCssSegment(key); // Validate before recursion.
      visit(value, [...path, key]);
    }
  }
  visit(tree, []);
  if (tokens.size === 0) fail('No design tokens found');
  return tokens;
}

const aliasPattern = /^\{([A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*)\}$/;
function literalToCss(type, value, name) {
  if (type === 'color') {
    if (typeof value !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(value)) {
      fail(`Expected a six-digit hex color at ${name}`);
    }
    return value;
  }
  if (type === 'dimension') {
    if (typeof value !== 'string' || !/^(?:0|[0-9]+(?:\.[0-9]+)?)(?:px|rem|em|%)$/.test(value)) {
      fail(`Expected a safe CSS dimension at ${name}`);
    }
    return value;
  }
  if (type === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      fail(`Expected a finite nonnegative number at ${name}`);
    }
    return String(value);
  }
  if (type === 'fontWeight') {
    if (!Number.isInteger(value) || value < 1 || value > 1000) {
      fail(`Expected an integer font weight from 1 to 1000 at ${name}`);
    }
    return String(value);
  }
  if (type === 'fontFamily') {
    if (!Array.isArray(value) || value.length === 0 || value.some(
      name => typeof name !== 'string' || !/^[A-Za-z0-9_-]+(?: [A-Za-z0-9_-]+)*$/.test(name)
    )) {
      fail(`Expected a nonempty safe font-family list at ${name}`);
    }
    return value.map(name => name.includes(' ') ? `"${name}"` : name).join(', ');
  }
  fail(`Unsupported token type ${type} at ${name}`);
}

function compile(tokens) {
  const checked = new Set();
  const checking = new Set();

  function validate(key) {
    const token = tokens.get(key);
    if (!token) fail(`Missing alias target: ${key}`);
    if (checked.has(key)) return;
    if (checking.has(key)) fail(`Circular alias reference involving ${key}`);
    checking.add(key);
    const value = token.$value;
    const match = typeof value === 'string' ? aliasPattern.exec(value) : null;
    if (match) {
      const targetKey = match[1];
      const target = tokens.get(targetKey);
      if (!target) fail(`Missing alias target ${targetKey} referenced by ${key}`);
      if (target.$type !== token.$type) {
        fail(`Type mismatch: ${key} (${token.$type}) references ${targetKey} (${target.$type})`);
      }
      validate(targetKey);
    } else {
      if (typeof value === 'string' && (value.startsWith('{') || value.endsWith('}'))) {
        fail(`Malformed alias reference in ${key}`);
      }
      literalToCss(token.$type, value, key);
    }
    checking.delete(key);
    checked.add(key);
  }

  for (const key of tokens.keys()) validate(key);
  const entries = [...tokens.entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
  return entries.map(([key, token]) => {
    const match = typeof token.$value === 'string' ? aliasPattern.exec(token.$value) : null;
    const value = match
      ? `var(${tokens.get(match[1]).cssName})`
      : literalToCss(token.$type, token.$value, key);
    return `  ${token.cssName}: ${value};`;
  });
}

try {
  const sourceBytes = readFileSync(input);
  const parsed = JSON.parse(sourceBytes.toString('utf8'));
  const tokens = collectTokens(parsed);
  const lines = compile(tokens);
  const digest = createHash('sha256').update(sourceBytes).digest('hex');
  const css = [
    '/* GENERATED FILE — DO NOT EDIT.',
    ' * Source: design-system/tokens.json',
    ' * Regenerate: node scripts/generate-design-tokens.mjs',
    ` * Source SHA-256: ${digest}`,
    ' * Visual semantics only; do not infer engineering approval or safety.',
    ' */',
    ':root {',
    ...lines,
    '}',
    '',
  ].join('\n');

  if (checkOnly) {
    let actual;
    try {
      actual = readFileSync(output, 'utf8');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      fail('Generated CSS is missing. Run: node scripts/generate-design-tokens.mjs');
    }
    if (actual !== css) {
      fail('Generated CSS is stale. Run: node scripts/generate-design-tokens.mjs and commit the result.');
    }
    console.log(`PASS: ${tokens.size} design tokens; generated CSS is current.`);
  } else {
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, css, 'utf8');
    console.log(`Generated ${tokens.size} CSS variables: ${output}`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
