#!/usr/bin/env node
// Prompt Pocket — release helper. Bumps the plugin version in the TWO places the official
// `/plugin update` cares about, in one shot, so they can never drift:
//   - .claude-plugin/plugin.json        (version)
//   - .claude-plugin/marketplace.json   (plugins[].version for this plugin)
//
// Why it matters: `/plugin update` only reinstalls when the version actually changes. Forget
// to bump and every user's "one-click update" is a silent no-op. This makes the bump a single
// command run from repo root.
//
// Usage:  node scripts/bump-version.mjs <patch|minor|major|X.Y.Z>
//   patch  0.2.0 -> 0.2.1     minor  0.2.0 -> 0.3.0     major  0.2.0 -> 1.0.0
//   0.4.2  -> set that exact version

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');

// Compute the next semver from the current one + a spec (keyword or explicit X.Y.Z).
function nextVersion(cur, spec) {
  if (/^\d+\.\d+\.\d+$/.test(spec)) return spec;
  const parts = String(cur).split('.').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN))
    throw new Error(`current version is not X.Y.Z: ${cur}`);
  const [maj, min, pat] = parts;
  if (spec === 'major') return `${maj + 1}.0.0`;
  if (spec === 'minor') return `${maj}.${min + 1}.0`;
  if (spec === 'patch') return `${maj}.${min}.${pat + 1}`;
  throw new Error(`bad version spec: "${spec}" (use patch|minor|major|X.Y.Z)`);
}

// Apply the bump to both manifests under `repo`. Returns { cur, next }. Keeps the on-disk
// shape (2-space indent + trailing newline) so the diff is just the version line(s).
function bump(repo, spec) {
  const pPath = join(repo, '.claude-plugin', 'plugin.json');
  const mPath = join(repo, '.claude-plugin', 'marketplace.json');
  const plugin = JSON.parse(readFileSync(pPath, 'utf8'));
  const market = JSON.parse(readFileSync(mPath, 'utf8'));
  const cur = plugin.version;
  const next = nextVersion(cur, spec);
  plugin.version = next;
  let touched = 0;
  for (const p of market.plugins || []) {
    if (p.name === plugin.name) { p.version = next; touched++; }
  }
  if (!touched) throw new Error(`marketplace.json has no plugin named "${plugin.name}"`);
  writeFileSync(pPath, JSON.stringify(plugin, null, 2) + '\n');
  writeFileSync(mPath, JSON.stringify(market, null, 2) + '\n');
  return { cur, next };
}

export { nextVersion, bump };

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const spec = process.argv[2];
  if (!spec) {
    console.error('usage: node scripts/bump-version.mjs <patch|minor|major|X.Y.Z>');
    process.exit(1);
  }
  try {
    const { cur, next } = bump(REPO, spec);
    console.log(`prompt-pocket: ${cur} -> ${next}`);
    console.log('  ✓ .claude-plugin/plugin.json');
    console.log('  ✓ .claude-plugin/marketplace.json');
    console.log('next: commit + push + merge to main → users get it via one /plugin update.');
  } catch (e) {
    console.error(String((e && e.message) || e));
    process.exit(1);
  }
}
