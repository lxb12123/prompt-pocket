import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readdirSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { slugOf } from './pocket.mjs';

// ---- unit: slugOf ---------------------------------------------------------

test('slugOf strips spaces and punctuation, keeps only letters/digits', () => {
  const s = slugOf('hello world! pull-2');   // -> "helloworldpull2" (<= 16, kept whole)
  assert.match(s, /^[\p{L}\p{N}]+$/u);
  assert.equal(s, 'helloworldpull2');
});

test('slugOf keeps CJK and caps around 16 chars without a trailing dangle', () => {
  const s = slugOf('把这段中文文字翻译成英文并润色一下');     // 17 chars -> first 16
  assert.ok(s.length <= 28, `len ${s.length}`);
  assert.match(s, /^[\p{L}\p{N}]+$/u);
  assert.equal(s, '把这段中文文字翻译成英文并润色一');
});

test('slugOf extends through an ASCII word instead of cutting it mid-token', () => {
  // The 16-char target lands inside "Acmeflutter", so the slug should include the
  // whole word (not the old dangling "...Acmef"), capped at 28.
  const s = slugOf('你帮我拉取Acme-flutter的远程main分支来更新本地');
  assert.equal(s, '你帮我拉取Acmeflutter');
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
  seedStore(home, [P('把这段中文文字翻译成英文并润色一下', 12),
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

test('prompt text stays OUT of the preloaded description, only in the on-demand body', () => {
  const home = makeHome();
  mkdirSync(join(home, '.claude'), { recursive: true });
  const PROMPT = '把这段中文文字翻译成英文并润色一下';
  seedStore(home, [P(PROMPT, 12)]);
  run(home, 'sync');
  const dir = join(home, '.claude', 'commands', 'usually');
  const content = readFileSync(join(dir, readdirSync(dir).find(f => f.endsWith('.md'))), 'utf8');
  const descLine = content.split('\n').find(l => l.startsWith('description:'));
  // the description is what every session preloads — it must be generic, not the prompt
  assert.ok(descLine && !descLine.includes(PROMPT), `description leaked the prompt: ${descLine}`);
  // ...but the body (injected only when the command is run) still carries the full prompt
  const afterMarker = content.split('-->').slice(1).join('-->');
  assert.ok(afterMarker.includes(PROMPT), 'full prompt must remain in the command body');
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

  const ocDir = join(home, '.config', 'opencode', 'commands', 'usually');
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

test('sync migrates OpenCode legacy singular command/ → plural commands/ (marker-gated)', () => {
  const home = makeHome();
  mkdirSync(join(home, '.config', 'opencode'), { recursive: true });
  // simulate a prior install that wrote to the singular legacy dir
  const legacyDir = join(home, '.config', 'opencode', 'command', 'usually');
  mkdirSync(legacyDir, { recursive: true });
  writeFileSync(join(legacyDir, 'old.md'), `${'<!-- prompt-pocket:generated -->'}\nstale\n`);
  writeFileSync(join(legacyDir, 'mine.md'), 'hand-written, no marker\n');       // user file: must survive
  const legacyMgr = join(home, '.config', 'opencode', 'command', 'usually.md');
  writeFileSync(legacyMgr, `${'<!-- prompt-pocket:generated -->'}\nstale manager\n`);

  seedStore(home, [P('a fresh prompt', 9)]);
  run(home, 'sync');

  // new plural dir is now the source of truth
  const newDir = join(home, '.config', 'opencode', 'commands', 'usually');
  assert.equal(readdirSync(newDir).filter(f => f.endsWith('.md')).length, 1, 'written to plural commands/');
  assert.ok(existsSync(join(home, '.config', 'opencode', 'commands', 'usually.md')), 'plural manager written');
  // our marked legacy files are gone; the user's unmarked file survives
  assert.ok(!existsSync(join(legacyDir, 'old.md')), 'marked legacy command removed');
  assert.ok(!existsSync(legacyMgr), 'marked legacy manager removed');
  assert.ok(existsSync(join(legacyDir, 'mine.md')), 'unmarked user file preserved');
  rmSync(home, { recursive: true, force: true });
});

test('sync preserves an UNMARKED OpenCode legacy manager and removes an emptied legacy dir', () => {
  const home = makeHome();
  mkdirSync(join(home, '.config', 'opencode'), { recursive: true });
  const legacyDir = join(home, '.config', 'opencode', 'command', 'usually');
  mkdirSync(legacyDir, { recursive: true });
  writeFileSync(join(legacyDir, 'gen.md'), `${'<!-- prompt-pocket:generated -->'}\nstale\n`);  // only OUR marked file here
  const legacyMgr = join(home, '.config', 'opencode', 'command', 'usually.md');
  writeFileSync(legacyMgr, '---\ndescription: my own\n---\nhand-written manager, no marker\n');  // user file: must survive

  seedStore(home, [P('another fresh prompt', 9)]);
  run(home, 'sync');

  assert.ok(!existsSync(legacyDir), 'legacy dir holding only our marked files is removed');
  assert.ok(existsSync(legacyMgr), 'unmarked legacy manager (user file) is preserved');
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

test('dropdown filenames are prefixed with the list row number (seq), matching list output', () => {
  const home = makeHome();
  mkdirSync(join(home, '.claude'), { recursive: true });
  // counts 16 > 13 > 9 -> sorted; near-identical text would collide without the number
  seedStore(home, [P('帮我拉取同目录Acmeflutter', 9),
                   P('你帮我拉取Acmeflutter', 16),
                   P('你需要帮助我重新拉取Acmeflutter', 13)]);
  run(home, 'sync');
  const dir = join(home, '.claude', 'commands', 'usually');
  const files = readdirSync(dir).filter(f => f.endsWith('.md') && f !== 'usually.md');
  // one file per prompt, each prefixed 1·/2·/3· in count order
  assert.equal(files.length, 3);
  assert.ok(files.some(f => f.startsWith('1·你帮我拉取')), `missing 1· entry: ${files}`);
  assert.ok(files.some(f => f.startsWith('2·你需要帮助我')), `missing 2· entry: ${files}`);
  assert.ok(files.some(f => f.startsWith('3·帮我拉取')), `missing 3· entry: ${files}`);

  // list `seq` must line up with those filename prefixes
  const list = run(home, 'list');
  assert.deepEqual(list.high.map(p => p.seq), [1, 2, 3]);
  assert.equal(list.high[0].text, '你帮我拉取Acmeflutter');     // seq 1 == filename 1·…
  assert.equal(list.high[2].text, '帮我拉取同目录Acmeflutter'); // seq 3 == filename 3·…
  rmSync(home, { recursive: true, force: true });
});

// ---- integration: user-level bare /usually manager command ----------------

test('sync creates a bare /usually manager command for Claude + OpenCode (with hint), not Codex', () => {
  const home = makeHome();
  mkdirSync(join(home, '.claude'), { recursive: true });
  mkdirSync(join(home, '.config', 'opencode'), { recursive: true });
  mkdirSync(join(home, '.codex'), { recursive: true });
  seedStore(home, [P('some prompt', 8)]);
  run(home, 'sync');

  const claudeMgr = join(home, '.claude', 'commands', 'usually.md');
  assert.ok(existsSync(claudeMgr), 'claude manager exists');
  const body = readFileSync(claudeMgr, 'utf8');
  assert.match(body, /<!-- prompt-pocket:generated -->/);
  assert.match(body, /argument-hint:/);

  assert.ok(existsSync(join(home, '.config', 'opencode', 'commands', 'usually.md')), 'opencode manager exists');
  // Codex has no bare command concept — no manager file (only usually-<slug>.md run buttons)
  assert.ok(!existsSync(join(home, '.codex', 'prompts', 'usually.md')), 'no codex manager');
  rmSync(home, { recursive: true, force: true });
});

test('manager never clobbers a user-authored usually.md (no marker), but refreshes a managed one', () => {
  const home = makeHome();
  mkdirSync(join(home, '.claude', 'commands'), { recursive: true });
  const mgr = join(home, '.claude', 'commands', 'usually.md');
  writeFileSync(mgr, '---\ndescription: my own command\n---\nhand-written, no marker\n');
  seedStore(home, [P('some prompt', 8)]);
  run(home, 'sync');
  assert.match(readFileSync(mgr, 'utf8'), /hand-written, no marker/, 'user file preserved');

  // now make it a managed file → it should be refreshed in place
  writeFileSync(mgr, `---\ndescription: stale\n---\n${'<!-- prompt-pocket:generated -->'}\nold\n`);
  run(home, 'sync');
  const after = readFileSync(mgr, 'utf8');
  assert.match(after, /argument-hint:/, 'managed file refreshed to current template');
  assert.ok(!after.includes('stale'), 'old managed content replaced');
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
