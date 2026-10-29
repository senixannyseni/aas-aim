import assert from 'node:assert/strict';
import {test} from 'node:test';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
const script = new URL('./github-private-bootstrap.sh', import.meta.url).pathname;
const source = readFileSync(script, 'utf8');
const exec = (...args) => spawnSync('bash', [script, ...args], {encoding:'utf8'});

test('default is a read-only preflight with no Github side effects', () => {
  const result = exec();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /READ ONLY/);
  assert.match(result.stdout, /READY: AAS–AIM GitHub CI source files present/);
});
test('help is read-only and documents explicit private publish', () => {
  const result = exec('--help');
  assert.equal(result.status,0);
  assert.match(result.stdout, /NEW PRIVATE GitHub repository/);
  assert.match(result.stdout, /--publish OWNER\/REPOSITORY/);
});
test('invalid publish destination cannot create a repository or git history', () => {
  const result = exec('--publish','https://github.com/example/repo');
  assert.equal(result.status,2);
  assert.match(result.stderr, /OWNER\/REPOSITORY/);
});
test('publishing must be opt-in and must refuse an existing git history', () => {
  assert.match(source,/mode="\$\{1:---check\}"/);
  assert.match(source,/if \[\[ -e \.git \]\]/);
  assert.match(source,/gh repo create "\$TARGET" --private --source \. --remote origin --push/);
  assert.doesNotMatch(source, /--public/);
});
test('publish runbook starts with lockfile candidate rather than automatic approval', () => {
  assert.match(source,/gh workflow run aim-next-lockfile-candidate.yml/);
  assert.match(source,/Have a maintainer review/);
  assert.match(source,/gh workflow run aim-next-ui.yml/);
});
