import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generate, readSource, TARGETS, syncAll } from './sync-mirrors.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');

// A minimal source fixture (a `prompt.md` body) carrying both install anchors, so the unit
// tests don't depend on the real (long) skill text.
const BODY = `# Title

- In this repo: \`skills/usually/scripts/pocket.mjs\` also works.
- **Normally you do nothing to install/update it**: the plugin's SessionStart hook
  re-syncs it after every \`/plugin update\` — so it's always current.
- **Fallback** (only if missing): \`cp ... ~/.prompt-pocket/pocket.mjs\`

Below, \`POCKET\` means whichever path exists.

tail body line
`;
const SRC = { body: BODY, description: 'DESC LINE' };
const targetByPath = (p) => TARGETS.find((t) => t.path === p);

// ---- unit: frontmatter variants ------------------------------------------

test('asis target renders just `description:` then a blank line then the body', () => {
  const skill = targetByPath('skills/usually/SKILL.md');
  const out = generate(SRC, skill);
  assert.equal(out, `---\ndescription: DESC LINE\n---\n\n${BODY}`);
});

test('name target inserts `name: usually` before description', () => {
  const oc = targetByPath('.opencode/skills/usually/SKILL.md');
  const out = generate(SRC, oc);
  assert.ok(out.startsWith('---\nname: usually\ndescription: DESC LINE\n---\n'),
    `frontmatter not as expected:\n${out.slice(0, 80)}`);
});

test('cursor target appends `alwaysApply: false` after description (no name)', () => {
  const cur = targetByPath('.cursor/rules/usually.mdc');
  const out = generate(SRC, cur);
  assert.ok(out.startsWith('---\ndescription: DESC LINE\nalwaysApply: false\n---\n'),
    `frontmatter not as expected:\n${out.slice(0, 90)}`);
  assert.ok(!out.includes('name: usually'), 'cursor must not carry name:');
});

// ---- unit: install-section swap ------------------------------------------

test('manual targets swap the SessionStart-hook wording for the cp wording', () => {
  const oc = targetByPath('.opencode/skills/usually/SKILL.md');
  const out = generate(SRC, oc);
  assert.ok(!out.includes('Normally you do nothing'), 'claude hook wording must be gone');
  assert.ok(!out.includes('SessionStart hook'), 'claude hook wording must be gone');
  assert.ok(out.includes('- **Bootstrap**'), 'manual bootstrap bullet missing');
  assert.ok(out.includes('- **Keep it fresh**'), 'manual keep-it-fresh bullet missing');
});

test('claude/asis target keeps the SessionStart-hook wording verbatim', () => {
  const claude = targetByPath('.claude/skills/usually/SKILL.md');
  const out = generate(SRC, claude);
  assert.ok(out.includes('SessionStart hook'), 'claude target must keep hook wording');
  assert.ok(!out.includes('**Bootstrap**'), 'claude target must not get manual wording');
});

test('install swap preserves the surrounding anchors and shared body', () => {
  const oc = targetByPath('.opencode/skills/usually/SKILL.md');
  const out = generate(SRC, oc);
  assert.ok(out.includes('- In this repo: `skills/usually/scripts/pocket.mjs` also works.'));
  assert.ok(out.includes('Below, `POCKET` means whichever path exists.'));
  assert.ok(out.includes('tail body line'), 'shared body after the anchor must survive');
});

// ---- unit: source assembly -----------------------------------------------

test('readSource joins skill.yaml description + when-to-use with one space', () => {
  const src = readSource(REPO);
  assert.ok(src.description.includes('OpenCode sessions. Use when the user wants'),
    `description not joined as expected:\n${src.description}`);
  assert.ok(src.body.startsWith('# /usually'), 'body should be prompt.md (no frontmatter)');
});

// ---- drift guard: every real target must equal what the generator emits ----

for (const target of TARGETS) {
  test(`in sync with source: ${target.path}`, () => {
    const src = readSource(REPO);
    const file = join(REPO, target.path);
    assert.ok(existsSync(file), `${target.path} is missing — run: node scripts/sync-mirrors.mjs`);
    const onDisk = readFileSync(file, 'utf8');
    assert.equal(onDisk, generate(src, target),
      `${target.path} is stale — run: node scripts/sync-mirrors.mjs`);
  });
}

test('syncAll --check on the real repo reports no stale targets', () => {
  const { stale } = syncAll({ repoRoot: REPO, check: true });
  assert.deepEqual(stale, [], `stale targets: ${stale.join(', ')}`);
});
