'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const script = path.join(__dirname, 'offline-regression.cjs');

test('offline runner rejects the TypeScript 7 CLI-only package with a clear diagnostic', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aim-ts7-api-'));
  try {
    const fake = path.join(dir, 'typescript7.cjs');
    fs.writeFileSync(fake, 'module.exports = { version: "7.0.2" };\n');
    const run = spawnSync(process.execPath, [script], {
      encoding: 'utf8',
      env: {...process.env, TS_COMPILER_PATH: fake},
    });
    assert.equal(run.status, 1, run.stderr);
    assert.match(run.stderr, /needs the TypeScript 6 compiler API/);
    assert.match(run.stderr, /TypeScript 7 only exposes the native CLI/);
    assert.doesNotMatch(run.stderr, /LOAD FAILED:/);
  } finally {
    fs.rmSync(dir, {recursive:true, force:true});
  }
});

test('offline runner pins the TypeScript 6 API separately from the strict TS7 typecheck', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  assert.equal(pkg.devDependencies.typescript, '7.0.2');
  assert.equal(pkg.devDependencies['@typescript/typescript6'], '6.0.2');
  const runner = fs.readFileSync(script,'utf8');
  assert.match(runner, /require\('@typescript\/typescript6'\)/);
  assert.match(runner, /ts\.transpileModule/);
});
