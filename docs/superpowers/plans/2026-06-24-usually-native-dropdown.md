# /usually Native Dropdown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/usually` surface saved prompts in the host's native slash dropdown on Claude Code, OpenCode, and Codex by generating one command/prompt file per saved prompt.

**Architecture:** `pocket.mjs` gains pure helper `slugOf` and a side-effecting `regenCommands` that writes one file per high-frequency/manual prompt into each installed host's command directory, driven by a targets table. Generation is wired into every store mutation and exposed as a standalone `sync` command. The script gets a `PROMPT_POCKET_HOME` env override and a main-module dispatch guard so its helpers are unit-testable.

**Tech Stack:** Node.js (ESM, v22+; dev box v25), `node:test` + `node:assert` test runner, `node:fs`/`node:path`/`node:os`, `node:child_process` for integration tests.

## Global Constraints

- The deterministic core lives only in `skills/usually/scripts/pocket.mjs`; users run a copy at `~/.prompt-pocket/pocket.mjs`. Edit the repo copy.
- Output of every CLI command is a single JSON object on stdout (existing contract). New fields are additive.
- Generation must NEVER throw out of a mutating command — a failed host is reported, not fatal.
- Generated files carry the exact marker `<!-- prompt-pocket:generated -->` and are the only files the generator may delete.
- Codex dir `~/.codex/prompts/` is SHARED: only delete files matching `usually-*.md` AND bearing the marker.
- Slugs keep only letters (incl. CJK) + digits, max 12 chars, fallback to 8-char id; numeric `-N` suffix only on collision.
- `THRESHOLD = 7`; high set = `count >= THRESHOLD || source === 'manual'`, sorted by count (existing `sortByCount`).
- Target dirs and forms (verbatim):
  - claude: `~/.claude/commands/usually/<slug>.md` → `/usually:<slug>` (guard `~/.claude/`, owned subdir, no `$`-escape)
  - opencode: `~/.config/opencode/command/usually/<slug>.md` → `/usually:<slug>` (guard `~/.config/opencode/`, owned subdir, `$`-escape)
  - codex: `~/.codex/prompts/usually-<slug>.md` → `/prompts:usually-<slug>` (guard `~/.codex/`, SHARED dir, `usually-` delete gate, `$`-escape)

---

### Task 1: Make `pocket.mjs` testable + add `slugOf`

**Files:**
- Modify: `skills/usually/scripts/pocket.mjs`
- Create: `skills/usually/scripts/pocket.test.mjs`

**Interfaces:**
- Consumes: existing `norm(text)`, `idOf(text)` in `pocket.mjs`.
- Produces: `export function slugOf(text): string`; `export { regenCommands }` (added Task 2); module importable without running CLI dispatch; `HOME` honors `process.env.PROMPT_POCKET_HOME`.

- [ ] **Step 1: Write the failing test for `slugOf`**

Create `skills/usually/scripts/pocket.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slugOf } from './pocket.mjs';

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
  assert.ok(s.startsWith('把这段中'));
});

test('slugOf falls back to 8-hex id when nothing keepable', () => {
  const s = slugOf('🎉🎉🎉');
  assert.match(s, /^[0-9a-f]{8}$/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test skills/usually/scripts/pocket.test.mjs`
Expected: FAIL — `slugOf` is not exported (`SyntaxError: ... does not provide an export named 'slugOf'`) or the dispatch prints usage JSON.

- [ ] **Step 3: Add env override, import for url, and dispatch guard; implement `slugOf`**

In `skills/usually/scripts/pocket.mjs`:

3a. Change the HOME line (currently `const HOME = homedir();`) to:

```js
const HOME = process.env.PROMPT_POCKET_HOME || homedir();
```

3b. Add `pathToFileURL` to the `node:url` imports. Add this import near the other `node:` imports at the top:

```js
import { pathToFileURL } from 'node:url';
```

3c. Add `slugOf` next to the other helpers (after `idOf`):

```js
// Readable, filesystem-safe, deterministic slug from a prompt's text.
// Keeps letters (incl. CJK via \p{L}) and digits; drops everything else; caps at 12.
function slugOf(text) {
  const base = norm(text).replace(/[^\p{L}\p{N}]/gu, '').slice(0, 12);
  return base || idOf(text);
}
```

3d. At the very bottom, wrap the existing `switch (cmd)` dispatch in a main-module guard and export the helpers. Replace the trailing dispatch block:

```js
const [, , cmd, ...rest] = process.argv;
switch (cmd) {
  ...existing cases...
}
```

with:

```js
function main() {
  const [, , cmd, ...rest] = process.argv;
  switch (cmd) {
    ...existing cases unchanged...
  }
}

export { slugOf };

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
```

(Keep every existing `case` line exactly as-is inside `main()`.)

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test skills/usually/scripts/pocket.test.mjs`
Expected: PASS (3 passing). Also confirm the CLI still works: `node skills/usually/scripts/pocket.mjs list` prints a JSON object (not usage error).

- [ ] **Step 5: Commit**

```bash
git add skills/usually/scripts/pocket.mjs skills/usually/scripts/pocket.test.mjs
git commit -m "feat(pocket): add slugOf + make script importable/testable"
```

---

### Task 2: `regenCommands` (Claude target) + `sync` command

**Files:**
- Modify: `skills/usually/scripts/pocket.mjs`
- Modify: `skills/usually/scripts/pocket.test.mjs`

**Interfaces:**
- Consumes: `slugOf`, `sortByCount`, `loadStore`, `THRESHOLD`, `HOME`.
- Produces: `function regenCommands(store): { [host]: {written,dir} | {skipped} | {written:0,error} }`; new CLI `sync` → `{ ok:true, action:'sync', byHost }`; module-level `const GEN_MARKER`, `const TARGETS` (Claude row only this task).

- [ ] **Step 1: Write the failing integration test for Claude target + sync**

Append to `skills/usually/scripts/pocket.test.mjs`:

```js
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readdirSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test skills/usually/scripts/pocket.test.mjs`
Expected: FAIL — `sync` is unknown command (prints usage; `res.byHost` undefined → assertion error).

- [ ] **Step 3: Implement `regenCommands` (Claude row) + `sync`**

3a. Add `unlinkSync` to the `node:fs` import list (it currently imports `readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync`):

```js
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync, unlinkSync } from 'node:fs';
```

3b. Add these above `// ---- commands ----`:

```js
// ---- generated host command files ----------------------------------------
const GEN_MARKER = '<!-- prompt-pocket:generated -->';

// One row per host with a native slash dropdown. `owned` dirs are exclusively ours;
// `prefix` (codex only) gates deletion in a SHARED dir. `esc` escapes `$` for hosts
// that treat $NAME/$1 as placeholders.
const TARGETS = [
  { host: 'claude',
    guard: join(HOME, '.claude'),
    dir: join(HOME, '.claude', 'commands', 'usually'),
    name: (slug) => `${slug}.md`, esc: false },
];

function highPrompts(store) {
  return sortByCount(store.prompts).filter(
    (p) => (p.count || 0) >= THRESHOLD || p.source === 'manual');
}

function fileMarkdown(text, count, esc) {
  const desc = `${norm(text)}  (${count || 0}次)`;
  const body = esc ? text.replace(/\$/g, '$$$$') : text;   // $$$$ -> literal $$ in output
  return `---\ndescription: ${JSON.stringify(desc)}\n---\n${GEN_MARKER}\n` +
    `Run this saved Prompt Pocket prompt exactly as if the user just typed it — execute ` +
    `it now; do not echo it back or ask whether to proceed:\n\n${body}\n`;
}

function regenForTarget(t, high) {
  if (!existsSync(t.guard)) return { skipped: `no-${t.host}-dir` };
  try {
    mkdirSync(t.dir, { recursive: true });
    for (const f of readdirSync(t.dir)) {                  // delete only OUR previous files
      if (!f.endsWith('.md')) continue;
      if (t.prefix && !f.startsWith(t.prefix)) continue;   // shared dir: stay in our lane
      const full = join(t.dir, f);
      let content = '';
      try { content = readFileSync(full, 'utf8'); } catch { continue; }
      if (content.includes(GEN_MARKER)) { try { unlinkSync(full); } catch {} }
    }
    const used = new Set();
    let written = 0;
    for (const p of high) {
      let slug = slugOf(p.text), s = slug, n = 2;
      while (used.has(s)) s = `${slug}-${n++}`;
      used.add(s);
      writeFileSync(join(t.dir, t.name(s)), fileMarkdown(p.text, p.count, t.esc));
      written++;
    }
    return { written, dir: t.dir };
  } catch (e) {
    return { written: 0, error: String((e && e.message) || e) };
  }
}

function regenCommands(store) {
  const high = highPrompts(store);
  const byHost = {};
  for (const t of TARGETS) byHost[t.host] = regenForTarget(t, high);
  return byHost;
}

function safeRegen(store) {
  try { return regenCommands(store); } catch (e) { return { error: String(e) }; }
}
```

3c. Export `regenCommands` — change the export line from Task 1:

```js
export { slugOf, regenCommands };
```

3d. Add a `sync` case inside `main()`'s switch (before `default`):

```js
    case 'sync': { const store = loadStore(); out({ ok: true, action: 'sync', byHost: safeRegen(store) }); break; }
```

3e. Add `'sync'` to the `default` usage `commands` array so the help lists it.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test skills/usually/scripts/pocket.test.mjs`
Expected: PASS (all tests). The Claude file set has exactly 1 file with marker + phrase.

- [ ] **Step 5: Commit**

```bash
git add skills/usually/scripts/pocket.mjs skills/usually/scripts/pocket.test.mjs
git commit -m "feat(pocket): regenCommands + sync (Claude Code target)"
```

---

### Task 3: Add OpenCode + Codex targets (shared-dir safety, $-escape, deletion, idempotency)

**Files:**
- Modify: `skills/usually/scripts/pocket.mjs`
- Modify: `skills/usually/scripts/pocket.test.mjs`

**Interfaces:**
- Consumes: `TARGETS`, `regenForTarget`, `fileMarkdown`.
- Produces: two more rows in `TARGETS` (opencode, codex). No new exports.

- [ ] **Step 1: Write failing tests for OpenCode + Codex + safety + idempotency**

Append to `skills/usually/scripts/pocket.test.mjs`:

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test skills/usually/scripts/pocket.test.mjs`
Expected: FAIL — opencode/codex are `skipped`/absent so `.written` is undefined; Codex files not created.

- [ ] **Step 3: Add the OpenCode + Codex rows to `TARGETS`**

Replace the `TARGETS` array body with all three rows:

```js
const TARGETS = [
  { host: 'claude',
    guard: join(HOME, '.claude'),
    dir: join(HOME, '.claude', 'commands', 'usually'),
    name: (slug) => `${slug}.md`, esc: false },
  { host: 'opencode',
    guard: join(HOME, '.config', 'opencode'),
    dir: join(HOME, '.config', 'opencode', 'command', 'usually'),
    name: (slug) => `${slug}.md`, esc: true },
  { host: 'codex',
    guard: join(HOME, '.codex'),
    dir: join(HOME, '.codex', 'prompts'),
    name: (slug) => `usually-${slug}.md`, prefix: 'usually-', esc: true },
];
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test skills/usually/scripts/pocket.test.mjs`
Expected: PASS (all tests, including the Task 2 Claude test still green).

- [ ] **Step 5: Commit**

```bash
git add skills/usually/scripts/pocket.mjs skills/usually/scripts/pocket.test.mjs
git commit -m "feat(pocket): add OpenCode + Codex dropdown targets"
```

---

### Task 4: Wire generation into every mutation

**Files:**
- Modify: `skills/usually/scripts/pocket.mjs`
- Modify: `skills/usually/scripts/pocket.test.mjs`

**Interfaces:**
- Consumes: `safeRegen`, existing `cmdScan/cmdAdd/cmdEdit/cmdDelete`.
- Produces: each mutating command's JSON gains `byHost` + `commandsWritten` (sum of per-host `written`).

- [ ] **Step 1: Write failing tests for add/delete wiring**

Append to `skills/usually/scripts/pocket.test.mjs`:

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test skills/usually/scripts/pocket.test.mjs`
Expected: FAIL — `res.commandsWritten`/`res.byHost` are undefined on `add`; delete leaves the file.

- [ ] **Step 3: Add a shared helper and call it from each mutation**

3a. Add near `safeRegen`:

```js
// Build the extra output fields every mutating command appends.
function regenFields(store) {
  const byHost = safeRegen(store);
  const commandsWritten = Object.values(byHost)
    .reduce((n, r) => n + (r && typeof r.written === 'number' ? r.written : 0), 0);
  return { byHost, commandsWritten };
}
```

3b. In `cmdScan`, change the final `out({...})` to spread the fields. The current call ends with `addedCount: added.length, updatedCount: updated.length, added, updated, });` — add before the closing `});`:

```js
    ...regenFields(store),
```

3c. In `cmdAdd`, change `out({ ok: true, action: 'add', prompt: p });` to:

```js
  out({ ok: true, action: 'add', prompt: p, ...regenFields(store) });
```

3d. In `cmdEdit`, change `out({ ok: true, action: 'edit', before, after: p });` to:

```js
  out({ ok: true, action: 'edit', before, after: p, ...regenFields(store) });
```

3e. In `cmdDelete`, change `out({ ok: true, action: 'delete', removed: p });` to:

```js
  out({ ok: true, action: 'delete', removed: p, ...regenFields(store) });
```

(Leave `cmdList` and `cmdFind` untouched — they don't mutate.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test skills/usually/scripts/pocket.test.mjs`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add skills/usually/scripts/pocket.mjs skills/usually/scripts/pocket.test.mjs
git commit -m "feat(pocket): refresh dropdowns on scan/add/edit/delete"
```

---

### Task 5: Update skill + command docs across all host copies

**Files (all Modify):**
- `skills/usually/prompt.md`
- `skills/usually/SKILL.md`
- `skills/usually/reference/store-and-scan.md`
- `commands/usually.md`
- `.claude/commands/usually.md`
- `.claude/skills/usually/SKILL.md`
- `.opencode/commands/usually.md`
- `.opencode/skills/usually/SKILL.md`
- `.agents/skills/usually/SKILL.md`
- `.cursor/rules/usually.mdc`
- `README.md`

**Interfaces:**
- Consumes: behavior shipped in Tasks 1–4 (the `sync` command, auto-refresh on mutation, the three target dirs/forms).
- Produces: docs only; no runtime behavior. Verified by grep, not unit tests.

- [ ] **Step 1: Update `skills/usually/prompt.md`**

1a. In "The script" section, after the bootstrap bullet, add a refresh note so existing users get the new code:

```
- **Keep it fresh**: if you can see the repo copy, refresh the runtime copy so the
  dropdown feature is present: `cp skills/usually/scripts/pocket.mjs ~/.prompt-pocket/pocket.mjs`.
```

1b. In "Main flow", after the `scan` step, add a step documenting the generated dropdown:

```
1b. **Dropdowns refresh automatically.** `scan` (and every add/edit/delete) regenerates one
   native command per saved prompt, so the user can also pick without you:
   - Claude Code / OpenCode: type `/usually:` → arrow-pick a prompt → Enter runs it.
   - Codex: type `/prompts:usually` (Codex has no `/usually:` namespace; it also needs a
     restart to pick up new files).
   Mention `commandsWritten` from the JSON if it's > 0.
```

1c. Add a `sync` line to the Sub-actions list:

```
**sync** — force-regenerate the native dropdown files for every installed host
(normally automatic; use after a manual store edit):
`node ~/.prompt-pocket/pocket.mjs sync`
```

1d. In Principles, add:

```
- The native dropdown is generated by `sync` into each host's command dir
  (`~/.claude/commands/usually/`, `~/.config/opencode/command/usually/`,
  `~/.codex/prompts/usually-*.md`). Only files bearing the
  `<!-- prompt-pocket:generated -->` marker are ever deleted; Codex's shared dir is
  additionally gated by the `usually-` filename prefix.
```

- [ ] **Step 2: Mirror the same edits into `skills/usually/SKILL.md`**

The body of `skills/usually/SKILL.md` duplicates `prompt.md` (same headings). Apply the identical 1a–1d additions there.

- [ ] **Step 3: Update the command frontmatter copies**

In each of `commands/usually.md`, `.claude/commands/usually.md`, `.opencode/commands/usually.md`, replace the `argument-hint` value with:

```
argument-hint: "type /usually: to run a saved prompt · or add|find|edit|delete"
```

(`.opencode/commands/usually.md` has no `argument-hint` today — add the line under `description:`.) In all three, append one sentence to the `description:` value: ` Generates a native slash dropdown so you can pick a saved prompt directly.`

- [ ] **Step 4: Update the mirrored SKILL/rules copies**

`.claude/skills/usually/SKILL.md`, `.opencode/skills/usually/SKILL.md`, `.agents/skills/usually/SKILL.md` mirror `skills/usually/SKILL.md`. Re-apply the Step 1/2 additions to each (same headings exist). `.cursor/rules/usually.mdc`: add one bullet under its description summarizing "typing /usually: (Claude Code/OpenCode) or /prompts:usually (Codex) lists saved prompts in the native dropdown".

- [ ] **Step 5: Update `skills/usually/reference/store-and-scan.md` and `README.md`**

Add a "Native dropdown" subsection to both describing: the three target dirs and invocation forms (`/usually:<slug>`, `/prompts:usually-<slug>`), the readable-Chinese slug + `(N次)` in the description, the marker/prefix deletion safety, the `$`-escape for OpenCode/Codex, and the first-run note (a host's entries appear after the first `/usually`/scan populates them; Codex needs a restart).

- [ ] **Step 6: Verify consistency and commit**

Run: `grep -rl "prompt-pocket:generated\|/usually:\|/prompts:usually\|sync" skills commands README.md .claude .opencode .agents .cursor`
Expected: every doc file listed above appears (each mentions the new dropdown). Then:

```bash
git add -A
git commit -m "docs(usually): document native dropdown across all host copies"
```

---

## Notes for the implementer

- Run the whole suite anytime with `node --test skills/usually/scripts/`.
- Tests never touch your real `~/.claude` / `~/.codex` / `~/.config/opencode` — they set `PROMPT_POCKET_HOME` to a throwaway temp dir. Never run a test that omits that env var against your real home.
- The dev box is Node v25; the floor is v22 (for `node:sqlite` in `opencodeTexts`). Don't use APIs newer than v22.
