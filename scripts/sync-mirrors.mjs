#!/usr/bin/env node
// Prompt Pocket — skill compiler. The /usually skill is authored ONCE as a source pair:
//   - skills/usually/prompt.md   the skill body (no frontmatter)
//   - skills/usually/skill.yaml  name / description / when-to-use
// Everything else is a GENERATED artifact: the canonical skills/usually/SKILL.md and one
// copy per host. Each target differs from the source along only two axes:
//   1. frontmatter   — canonical + Claude keep just `description:`; OpenCode/Codex/Gemini add
//                      `name: usually`; Cursor adds `alwaysApply: false`.
//   2. install section — canonical + Claude keep the SessionStart-hook wording; the other
//                        hosts get the manual `cp` wording (that hook never runs off Claude).
// So a body edit in prompt.md propagates to all six targets with one command and can never
// drift silently — the test asserts each on-disk target equals what this compiler emits.
//
// Usage:
//   node scripts/sync-mirrors.mjs           write every target, report which changed
//   node scripts/sync-mirrors.mjs --check   write nothing; exit 1 if any target is stale

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const PROMPT = 'skills/usually/prompt.md';
const SKILL_YAML = 'skills/usually/skill.yaml';

// One row per generated file. `frontmatter`: asis | name | cursor.  `install`: claude | manual.
export const TARGETS = [
  { path: 'skills/usually/SKILL.md',           frontmatter: 'asis',   install: 'claude' },
  { path: '.claude/skills/usually/SKILL.md',   frontmatter: 'asis',   install: 'claude' },
  { path: '.opencode/skills/usually/SKILL.md', frontmatter: 'name',   install: 'manual' },
  { path: '.agents/skills/usually/SKILL.md',   frontmatter: 'name',   install: 'manual' },
  { path: '.gemini/skills/usually/SKILL.md',   frontmatter: 'name',   install: 'manual' },
  { path: '.cursor/rules/usually.mdc',         frontmatter: 'cursor', install: 'manual' },
];

// Stable anchors that bracket the install bullet block inside the skill body.
const ANCHOR_BEFORE = '- In this repo: `skills/usually/scripts/pocket.mjs` also works.\n';
const ANCHOR_AFTER = '\n\nBelow, `POCKET` means';

// The non-Claude install block. This is the ONLY prose this compiler owns (the body can't
// express two install variants); kept here as a single tested source.
const MANUAL_INSTALL =
  '- **Bootstrap** (do this if `~/.prompt-pocket/pocket.mjs` is missing and you can see the\n' +
  '  repo copy): `mkdir -p ~/.prompt-pocket && cp skills/usually/scripts/pocket.mjs ~/.prompt-pocket/pocket.mjs`\n' +
  '- **Keep it fresh**: if you can see the repo copy, refresh the runtime copy so the native\n' +
  '  dropdown feature is present: `cp skills/usually/scripts/pocket.mjs ~/.prompt-pocket/pocket.mjs`';

const yamlField = (text, key) => {
  const m = text.match(new RegExp(`^${key}:\\s*(.*)$`, 'm'));
  if (!m) throw new Error(`skill.yaml is missing \`${key}\``);
  return m[1].trim();
};

// Read the source pair into { body, description }. The frontmatter description is the Forge
// rule: the skill.yaml description and when-to-use joined by a single space.
export function readSource(root) {
  const body = readFileSync(join(root, PROMPT), 'utf8');
  const yaml = readFileSync(join(root, SKILL_YAML), 'utf8');
  const description = `${yamlField(yaml, 'description')} ${yamlField(yaml, 'when-to-use')}`;
  return { body, description };
}

function buildFrontmatter(description, variant) {
  if (variant === 'asis') return `---\ndescription: ${description}\n---\n`;
  if (variant === 'name') return `---\nname: usually\ndescription: ${description}\n---\n`;
  if (variant === 'cursor') return `---\ndescription: ${description}\nalwaysApply: false\n---\n`;
  throw new Error(`unknown frontmatter variant: ${variant}`);
}

function swapInstall(body, variant) {
  if (variant === 'claude') return body;          // the body already carries the Claude wording
  if (variant !== 'manual') throw new Error(`unknown install variant: ${variant}`);
  const start = body.indexOf(ANCHOR_BEFORE);
  if (start === -1) throw new Error('install ANCHOR_BEFORE not found in skill body');
  const installAt = start + ANCHOR_BEFORE.length;
  const end = body.indexOf(ANCHOR_AFTER, installAt);
  if (end === -1) throw new Error('install ANCHOR_AFTER not found in skill body');
  return body.slice(0, installAt) + MANUAL_INSTALL + body.slice(end);
}

// Pure: given the source pair + a target row, return the exact expected file text.
export function generate(source, target) {
  return buildFrontmatter(source.description, target.frontmatter)
    + '\n' + swapInstall(source.body, target.install);
}

// Generate every target. check=true => report stale without writing. Returns {changed, stale}.
export function syncAll({ repoRoot, check = false } = {}) {
  const root = repoRoot || join(dirname(fileURLToPath(import.meta.url)), '..');
  const source = readSource(root);
  const changed = [];
  const stale = [];
  for (const target of TARGETS) {
    const want = generate(source, target);
    const file = join(root, target.path);
    const have = existsSync(file) ? readFileSync(file, 'utf8') : null;
    if (have === want) continue;
    (check ? stale : changed).push(target.path);
    if (!check) {
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, want);
    }
  }
  return { changed, stale };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const check = process.argv.includes('--check');
  const { changed, stale } = syncAll({ check });
  if (check) {
    if (stale.length) {
      console.error('Stale targets (run `node scripts/sync-mirrors.mjs`):\n  ' + stale.join('\n  '));
      process.exit(1);
    }
    console.log('All targets in sync.');
  } else {
    console.log(changed.length ? 'Regenerated:\n  ' + changed.join('\n  ') : 'All targets already current.');
  }
}
