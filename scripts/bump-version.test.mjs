import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { nextVersion, bump } from './bump-version.mjs';

// ---- unit: nextVersion ----------------------------------------------------

test('nextVersion bumps patch/minor/major and resets lower parts', () => {
  assert.equal(nextVersion('0.2.0', 'patch'), '0.2.1');
  assert.equal(nextVersion('0.2.3', 'minor'), '0.3.0');
  assert.equal(nextVersion('0.2.3', 'major'), '1.0.0');
});

test('nextVersion accepts an explicit X.Y.Z', () => {
  assert.equal(nextVersion('0.2.0', '1.4.2'), '1.4.2');
});

test('nextVersion rejects a bad spec', () => {
  assert.throws(() => nextVersion('0.2.0', 'banana'), /bad version spec/);
});

// ---- integration: bump writes both manifests in sync ----------------------

function makeRepo(version) {
  const repo = mkdtempSync(join(tmpdir(), 'pp-bump-'));
  mkdirSync(join(repo, '.claude-plugin'), { recursive: true });
  writeFileSync(join(repo, '.claude-plugin', 'plugin.json'),
    JSON.stringify({ name: 'prompt-pocket', version, license: 'MIT' }, null, 2) + '\n');
  writeFileSync(join(repo, '.claude-plugin', 'marketplace.json'),
    JSON.stringify({ name: 'm', plugins: [{ name: 'prompt-pocket', source: './', version }] }, null, 2) + '\n');
  return repo;
}
const readJson = (repo, f) => JSON.parse(readFileSync(join(repo, '.claude-plugin', f), 'utf8'));

test('bump updates BOTH manifests to the same new version', () => {
  const repo = makeRepo('0.2.0');
  const { cur, next } = bump(repo, 'minor');
  assert.equal(cur, '0.2.0');
  assert.equal(next, '0.3.0');
  assert.equal(readJson(repo, 'plugin.json').version, '0.3.0');
  assert.equal(readJson(repo, 'marketplace.json').plugins[0].version, '0.3.0');
  rmSync(repo, { recursive: true, force: true });
});

test('bump preserves 2-space indent + trailing newline (minimal diff)', () => {
  const repo = makeRepo('0.2.0');
  bump(repo, 'patch');
  const raw = readFileSync(join(repo, '.claude-plugin', 'plugin.json'), 'utf8');
  assert.ok(raw.endsWith('}\n'), 'trailing newline kept');
  assert.match(raw, /\n  "version": "0\.2\.1"/, '2-space indent kept');
  rmSync(repo, { recursive: true, force: true });
});

test('bump heals drift: both end up at the new version even if they started apart', () => {
  const repo = makeRepo('0.2.0');
  // simulate drift: marketplace left behind at 0.1.0
  const mPath = join(repo, '.claude-plugin', 'marketplace.json');
  const m = JSON.parse(readFileSync(mPath, 'utf8'));
  m.plugins[0].version = '0.1.0';
  writeFileSync(mPath, JSON.stringify(m, null, 2) + '\n');
  bump(repo, 'patch');                                   // from plugin.json's 0.2.0 -> 0.2.1
  assert.equal(readJson(repo, 'plugin.json').version, '0.2.1');
  assert.equal(readJson(repo, 'marketplace.json').plugins[0].version, '0.2.1');
  rmSync(repo, { recursive: true, force: true });
});
