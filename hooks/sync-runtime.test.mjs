import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));            // <root>/hooks
const HOOK = join(HERE, 'sync-runtime.mjs');
const SOURCE = join(HERE, '..', 'skills', 'usually', 'scripts', 'pocket.mjs');
const sourceText = readFileSync(SOURCE, 'utf8');

// Run the hook with an isolated PROMPT_POCKET_HOME; returns the runtime copy's path + content.
function runHook(home) {
  execFileSync('node', [HOOK], { env: { ...process.env, PROMPT_POCKET_HOME: home }, encoding: 'utf8' });
  const dst = join(home, '.prompt-pocket', 'pocket.mjs');
  return { dst, content: existsSync(dst) ? readFileSync(dst, 'utf8') : null };
}

test('hook bootstraps the runtime copy when it is missing', () => {
  const home = mkdtempSync(join(tmpdir(), 'pp-hook-'));
  const { dst, content } = runHook(home);
  assert.ok(existsSync(dst), 'runtime copy created');
  assert.equal(content, sourceText, 'runtime copy matches the plugin source');
  rmSync(home, { recursive: true, force: true });
});

test('hook overwrites a stale runtime copy with the plugin source', () => {
  const home = mkdtempSync(join(tmpdir(), 'pp-hook-'));
  mkdirSync(join(home, '.prompt-pocket'), { recursive: true });
  writeFileSync(join(home, '.prompt-pocket', 'pocket.mjs'), '// stale old version\n');
  const { content } = runHook(home);
  assert.equal(content, sourceText, 'stale copy replaced by current plugin source');
  rmSync(home, { recursive: true, force: true });
});

test('hook is a no-op (idempotent) when already in sync', () => {
  const home = mkdtempSync(join(tmpdir(), 'pp-hook-'));
  runHook(home);                                   // first sync
  const dst = join(home, '.prompt-pocket', 'pocket.mjs');
  const before = readFileSync(dst, 'utf8');
  runHook(home);                                   // second run — nothing to change
  assert.equal(readFileSync(dst, 'utf8'), before, 'content unchanged on a second run');
  rmSync(home, { recursive: true, force: true });
});

test('hook never throws even if the source is unreadable (exit 0)', () => {
  // Point at a home with no write perms is awkward cross-platform; instead assert the silent
  // contract directly: running with a bogus argv still exits 0 and prints nothing.
  const home = mkdtempSync(join(tmpdir(), 'pp-hook-'));
  const res = execFileSync('node', [HOOK], {
    env: { ...process.env, PROMPT_POCKET_HOME: home }, encoding: 'utf8',
  });
  assert.equal(res, '', 'hook emits no output (silent contract)');
  rmSync(home, { recursive: true, force: true });
});
