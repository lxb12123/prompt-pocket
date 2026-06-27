#!/usr/bin/env node
// Prompt Pocket — runtime self-heal (runs from the plugin's SessionStart hook).
//
// The skill always executes `~/.prompt-pocket/pocket.mjs` (a host-neutral copy shared by
// Claude / Codex / OpenCode). The PLUGIN ships the authoritative pocket.mjs under
// skills/usually/scripts/. After an official `/plugin update`, the plugin cache is refreshed
// but that shared runtime copy is NOT — so this hook reconciles them on every session start:
// if the runtime copy is missing or differs from the plugin's, overwrite it. That makes a
// one-click `/plugin update` propagate all the way to the code that actually runs, with no
// manual `cp`. It also handles first-time bootstrap (runtime copy absent on fresh install).
//
// Contract: silent, idempotent, and NEVER fails — any error is swallowed and we exit 0 so a
// broken sync can never block a session from starting.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Resolve the plugin's own pocket.mjs from THIS script's location (<root>/hooks/sync-runtime.mjs),
// so it works identically whether invoked as a plugin hook or straight from the repo — no reliance
// on ${CLAUDE_PLUGIN_ROOT} being exported to the child process.
function syncRuntime() {
  const here = dirname(fileURLToPath(import.meta.url));                  // <root>/hooks
  const src = join(here, '..', 'skills', 'usually', 'scripts', 'pocket.mjs');
  const home = process.env.PROMPT_POCKET_HOME || homedir();
  const dstDir = join(home, '.prompt-pocket');
  const dst = join(dstDir, 'pocket.mjs');

  const source = readFileSync(src, 'utf8');
  const current = existsSync(dst) ? readFileSync(dst, 'utf8') : null;
  if (source === current) return { changed: false, dst };               // already in sync — no write
  mkdirSync(dstDir, { recursive: true });
  writeFileSync(dst, source);
  return { changed: true, dst };
}

export { syncRuntime };                                                  // for tests

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { syncRuntime(); } catch { /* never block session start */ }
  process.exit(0);
}
