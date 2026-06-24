import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readdirSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { slugOf } from './pocket.mjs';

// ---- unit: slugOf ---------------------------------------------------------

test('slugOf strips spaces and punctuation, keeps letters/digits', () => {
  const s = slugOf('hello world! pull-2');   // -> "helloworldpull2" capped to 12
  assert.match(s, /^[\p{L}\p{N}]+$/u);
  assert.ok(s.length <= 12);
  assert.ok(s.startsWith('helloworld'));
});

test('slugOf keeps CJK and caps at 12 chars', () => {
  const s = slugOf('把这段中文文字翻译成英文并润色一下');
  assert.ok(s.length <= 12, `len ${s.length}`);
  assert.match(s, /^[\p{L}\p{N}]+$/u);
  assert.ok(s.startsWith('拉取线上'));
});

test('slugOf falls back to 8-hex id when nothing keepable', () => {
  const s = slugOf('🎉🎉🎉');
  assert.match(s, /^[0-9a-f]{8}$/);
});

// ---- integration helpers --------------------------------------------------

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'pocket.mjs');

function makeHome() {
  const home = mkdtempSync(join(tmpdir(), 'pp-'));
  mkdirSync(join(home, '.prompt-pocket'), { recursive: true });
  return home;
}
function seedStore(home, prompts) {
  writeFileSync(join(home, '.prompt-pocket', 'store.json'),
    JSON.stringify({ version: 1, prompts }, null, 2));
}
function run(home, ...args) {
  return JSON.parse(execFileSync('node', [SCRIPT, ...args], {
    env: { ...process.env, PROMPT_POCKET_HOME: home }, encoding: 'utf8',
  }));
}
const P = (text, count, source = 'auto') =>
  ({ id: 'x'.repeat(8), text, count, source, createdAt: '', updatedAt: '' });

// ---- integration: sync (Claude target) ------------------------------------

test('sync writes one Claude command file per high prompt with marker', () => {
  const home = makeHome();
  mkdirSync(join(home, '.claude'), { recursive: true });            // Claude installed
  seedStore(home, [P('把这段中文文字翻译成英文并润色一下', 16),
                   P('rare one', 2)]);                              // below threshold
  const res = run(home, 'sync');
  assert.equal(res.ok, true);
  assert.equal(res.byHost.claude.written, 1);
  assert.deepEqual(res.byHost.opencode, { skipped: 'no-opencode-dir' });
  assert.deepEqual(res.byHost.codex, { skipped: 'no-codex-dir' });
  const dir = join(home, '.claude', 'commands', 'usually');
  const files = readdirSync(dir).filter(f => f.endsWith('.md'));
  assert.equal(files.length, 1);
  const body = readFileSync(join(dir, files[0]), 'utf8');
  assert.match(body, /<!-- prompt-pocket:generated -->/);
  assert.match(body, /description:/);
  assert.ok(body.includes('把这段中文文字翻译成英文并润色一下'));
  rmSync(home, { recursive: true, force: true });
});

// ---- integration: OpenCode + Codex ----------------------------------------

test('sync writes OpenCode (namespaced) and Codex (prefixed) files', () => {
  const home = makeHome();
  mkdirSync(join(home, '.config', 'opencode'), { recursive: true });
  mkdirSync(join(home, '.codex'), { recursive: true });
  seedStore(home, [P('pull and recompile $HOME stuff', 9)]);   // contains a literal $
  const res = run(home, 'sync');
  assert.equal(res.byHost.opencode.written, 1);
  assert.equal(res.byHost.codex.written, 1);

  const ocDir = join(home, '.config', 'opencode', 'command', 'usually');
  const ocFiles = readdirSync(ocDir).filter(f => f.endsWith('.md'));
  assert.equal(ocFiles.length, 1);
  assert.match(readFileSync(join(ocDir, ocFiles[0]), 'utf8'), /\$\$HOME/);   // $ escaped

  const cxDir = join(home, '.codex', 'prompts');
  const cxFiles = readdirSync(cxDir).filter(f => f.endsWith('.md'));
  assert.equal(cxFiles.length, 1);
  assert.ok(cxFiles[0].startsWith('usually-'));
  assert.match(readFileSync(join(cxDir, cxFiles[0]), 'utf8'), /\$\$HOME/);
  rmSync(home, { recursive: true, force: true });
});

test('Codex shared dir: only our usually-* marked files are touched', () => {
  const home = makeHome();
  mkdirSync(join(home, '.codex', 'prompts'), { recursive: true });
  const cxDir = join(home, '.codex', 'prompts');
  writeFileSync(join(cxDir, 'mine.md'), '# my own prompt, no marker\n');
  writeFileSync(join(cxDir, 'usually-stale.md'), `${'<!-- prompt-pocket:generated -->'}\nold\n`);
  seedStore(home, [P('fresh prompt here', 8)]);
  run(home, 'sync');
  assert.ok(existsSync(join(cxDir, 'mine.md')), 'user file must survive');
  assert.ok(!existsSync(join(cxDir, 'usually-stale.md')), 'stale generated file removed');
  assert.equal(readdirSync(cxDir).filter(f => f.startsWith('usually-')).length, 1);
  rmSync(home, { recursive: true, force: true });
});

test('sync reflects deletions and is idempotent', () => {
  const home = makeHome();
  mkdirSync(join(home, '.claude'), { recursive: true });
  seedStore(home, [P('alpha prompt', 10), P('beta prompt', 9)]);
  run(home, 'sync');
  const dir = join(home, '.claude', 'commands', 'usually');
  assert.equal(readdirSync(dir).filter(f => f.endsWith('.md')).length, 2);
  const first = readdirSync(dir).sort().join(',');
  run(home, 'sync');                                            // idempotent
  assert.equal(readdirSync(dir).sort().join(','), first);
  seedStore(home, [P('alpha prompt', 10)]);                     // beta removed
  run(home, 'sync');
  assert.equal(readdirSync(dir).filter(f => f.endsWith('.md')).length, 1);
  rmSync(home, { recursive: true, force: true });
});

// ---- integration: mutation wiring -----------------------------------------

test('add refreshes the dropdown and reports commandsWritten', () => {
  const home = makeHome();
  mkdirSync(join(home, '.claude'), { recursive: true });
  seedStore(home, []);
  const res = run(home, 'add', 'deploy to staging then run smoke tests');
  assert.equal(res.ok, true);
  assert.ok(res.commandsWritten >= 1);
  assert.equal(res.byHost.claude.written, 1);
  const dir = join(home, '.claude', 'commands', 'usually');
  assert.equal(readdirSync(dir).filter(f => f.endsWith('.md')).length, 1);
  rmSync(home, { recursive: true, force: true });
});

test('delete removes the prompt and its command file', () => {
  const home = makeHome();
  mkdirSync(join(home, '.claude'), { recursive: true });
  seedStore(home, [P('only prompt', 10, 'manual')]);
  run(home, 'sync');
  const dir = join(home, '.claude', 'commands', 'usually');
  assert.equal(readdirSync(dir).filter(f => f.endsWith('.md')).length, 1);
  run(home, 'delete', 'only prompt');
  assert.equal(readdirSync(dir).filter(f => f.endsWith('.md')).length, 0);
  rmSync(home, { recursive: true, force: true });
});
