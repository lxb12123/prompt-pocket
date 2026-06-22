#!/usr/bin/env node
// Prompt Pocket — deterministic store + cross-agent transcript scanner (0-token core).
// All state-changing logic lives here so the LLM never has to "remember" data.
//
// Store:  ~/.prompt-pocket/store.json   (host-neutral, shared by every agent)
// Scan sources (whichever exist on the machine):
//   - Claude Code:  ~/.claude/projects/**/*.jsonl   (type:user, promptSource:typed)
//   - Codex CLI:    ~/.codex/sessions/**/*.jsonl     (event_msg, payload.type:user_message)
//
// Usage:  node skills/usually/scripts/pocket.mjs <command> [args]
//   list                     list prompts (sorted by count; high-frequency flagged)
//   scan                     scan transcripts from all agents, auto-record prompts said >= THRESHOLD
//   add   <text...>          manually record a prompt
//   delete <id|text...>      remove a prompt
//   edit  <id> <newtext...>  change a prompt's text
//   find  <query...>         search prompts by substring
// Output is always a single JSON object on stdout.

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { createHash } from 'node:crypto';

const THRESHOLD = 7;                       // auto-record once a prompt is repeated this many times
const HOME = homedir();
const STORE_DIR = join(HOME, '.prompt-pocket');
const STORE = join(STORE_DIR, 'store.json');
const LEGACY_STORE = join(HOME, '.claude', 'prompt-pocket', 'store.json');  // migrate-from

const nowISO = () => new Date().toISOString();
const out = (o) => process.stdout.write(JSON.stringify(o, null, 2) + '\n');

const norm = (t) => String(t).replace(/\s+/g, ' ').trim();
const keyOf = (t) => norm(t).toLowerCase();
const idOf = (t) => createHash('sha1').update(keyOf(t)).digest('hex').slice(0, 8);
const sortByCount = (arr) =>
  [...arr].sort((a, b) => (b.count || 0) - (a.count || 0) || a.text.localeCompare(b.text));

function loadStore() {
  const path = existsSync(STORE) ? STORE : existsSync(LEGACY_STORE) ? LEGACY_STORE : null;
  if (!path) return { version: 1, prompts: [] };
  try {
    const s = JSON.parse(readFileSync(path, 'utf8'));
    if (!Array.isArray(s.prompts)) s.prompts = [];
    return s;
  } catch {
    return { version: 1, prompts: [] };
  }
}

function saveStore(s) {
  mkdirSync(STORE_DIR, { recursive: true });
  writeFileSync(STORE, JSON.stringify(s, null, 2) + '\n');   // always writes to the new host-neutral path
}

// Resolve a prompt by id (exact or unique prefix) or by exact normalized text.
function findPrompt(store, idOrText) {
  const q = norm(idOrText);
  const exactId = store.prompts.find((p) => p.id === q);
  if (exactId) return exactId;
  const k = keyOf(q);
  const byText = store.prompts.find((p) => keyOf(p.text) === k);
  if (byText) return byText;
  const prefix = store.prompts.filter((p) => p.id.startsWith(q.toLowerCase()));
  return prefix.length === 1 ? prefix[0] : null;
}

// ---- transcript scanning (cross-agent) ------------------------------------

function cleanCandidate(raw) {
  let t = norm(raw);
  t = t.replace(/^[❯›>]\s+/, '');                      // strip a pasted prompt glyph
  if (t.length < 3) return null;                       // skip "ok", "yes", noise
  if (t.startsWith('/')) return null;                  // slash commands
  if (t.startsWith('#')) return null;                  // codex injects "# Files mentioned by the user:"
  if (t.startsWith('Caveat:')) return null;
  if (/<\/?(command|local-command|system-reminder|user-)/.test(t)) return null;
  if (t.includes('[Request interrupted')) return null;
  return t;
}

// Recursively collect *.jsonl files under dir (Codex nests by date).
function walkJsonl(dir) {
  const acc = [];
  if (!existsSync(dir)) return acc;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    let st;
    try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) acc.push(...walkJsonl(full));
    else if (entry.endsWith('.jsonl')) acc.push(full);
  }
  return acc;
}

function readJsonlTexts(dir, extract) {
  const texts = [];
  for (const f of walkJsonl(dir)) {
    let buf;
    try { buf = readFileSync(f, 'utf8'); } catch { continue; }
    for (const line of buf.split('\n')) {
      if (!line.trim()) continue;
      let ev;
      try { ev = JSON.parse(line); } catch { continue; }
      const t = extract(ev);
      if (t) texts.push(t);
    }
  }
  return texts;
}

// Claude Code: only genuinely human-typed input (promptSource === 'typed').
function claudeTexts() {
  return readJsonlTexts(join(HOME, '.claude', 'projects'), (ev) => {
    if (!ev || ev.type !== 'user' || ev.promptSource !== 'typed' || !ev.message) return null;
    const c = ev.message.content;
    let raw = '';
    if (typeof c === 'string') raw = c;
    else if (Array.isArray(c)) {
      const parts = c.filter((x) => x && x.type === 'text' && typeof x.text === 'string');
      if (!parts.length) return null;
      raw = parts.map((x) => x.text).join('\n');
    } else return null;
    return cleanCandidate(raw);
  });
}

// Codex CLI: event_msg with payload.type === 'user_message', text in payload.message.
function codexTexts() {
  return readJsonlTexts(join(HOME, '.codex', 'sessions'), (ev) => {
    if (!ev || ev.type !== 'event_msg' || !ev.payload || ev.payload.type !== 'user_message') return null;
    const raw = ev.payload.message;
    if (typeof raw !== 'string') return null;
    return cleanCandidate(raw);
  });
}

// ---- commands -------------------------------------------------------------

function cmdScan() {
  const bySource = { claude: claudeTexts(), codex: codexTexts() };
  const texts = [...bySource.claude, ...bySource.codex];
  const counts = new Map();                            // key -> { text, count }
  for (const t of texts) {
    const k = keyOf(t);
    const e = counts.get(k) || { text: t, count: 0 };
    e.count += 1;
    counts.set(k, e);
  }
  const store = loadStore();
  const added = [], updated = [];
  for (const { text, count } of counts.values()) {
    if (count < THRESHOLD) continue;
    const existing = findPrompt(store, text);
    if (existing) {
      if ((existing.count || 0) !== count) {
        existing.count = Math.max(existing.count || 0, count);
        existing.updatedAt = nowISO();
        updated.push(existing);
      }
    } else {
      const p = { id: idOf(text), text, count, source: 'auto', createdAt: nowISO(), updatedAt: nowISO() };
      store.prompts.push(p);
      added.push(p);
    }
  }
  saveStore(store);
  out({
    ok: true, action: 'scan', threshold: THRESHOLD,
    scanned: texts.length,
    bySource: { claude: bySource.claude.length, codex: bySource.codex.length },
    addedCount: added.length, updatedCount: updated.length, added, updated,
  });
}

function cmdList() {
  const store = loadStore();
  const all = sortByCount(store.prompts);
  const high = all.filter((p) => (p.count || 0) >= THRESHOLD || p.source === 'manual');
  out({ ok: true, action: 'list', threshold: THRESHOLD, total: all.length, high, all });
}

function cmdAdd(text) {
  const t = norm(text);
  if (!t) return out({ ok: false, error: 'empty text' });
  const store = loadStore();
  let p = findPrompt(store, t);
  if (p) {
    p.source = 'manual';
    p.count = p.count || 1;
    p.updatedAt = nowISO();
  } else {
    p = { id: idOf(t), text: t, count: 1, source: 'manual', createdAt: nowISO(), updatedAt: nowISO() };
    store.prompts.push(p);
  }
  saveStore(store);
  out({ ok: true, action: 'add', prompt: p });
}

function cmdDelete(idOrText) {
  const q = norm(idOrText);
  if (!q) return out({ ok: false, error: 'missing id or text' });
  const store = loadStore();
  const p = findPrompt(store, q);
  if (!p) return out({ ok: false, error: 'not found', query: q });
  store.prompts = store.prompts.filter((x) => x.id !== p.id);
  saveStore(store);
  out({ ok: true, action: 'delete', removed: p });
}

function cmdEdit(id, newText) {
  const q = norm(id);
  const nt = norm(newText);
  if (!q) return out({ ok: false, error: 'missing id' });
  if (!nt) return out({ ok: false, error: 'empty new text' });
  const store = loadStore();
  const p = findPrompt(store, q);
  if (!p) return out({ ok: false, error: 'not found', query: q });
  const before = p.text;
  p.text = nt;
  p.id = idOf(nt);
  p.updatedAt = nowISO();
  saveStore(store);
  out({ ok: true, action: 'edit', before, after: p });
}

function cmdFind(query) {
  const q = keyOf(query);
  if (!q) return out({ ok: false, error: 'empty query' });
  const store = loadStore();
  const matches = sortByCount(store.prompts.filter((p) => keyOf(p.text).includes(q)));
  out({ ok: true, action: 'find', query: norm(query), count: matches.length, matches });
}

// ---- dispatch -------------------------------------------------------------

const [, , cmd, ...rest] = process.argv;
switch (cmd) {
  case 'list': cmdList(); break;
  case 'scan': cmdScan(); break;
  case 'add': cmdAdd(rest.join(' ')); break;
  case 'delete': cmdDelete(rest.join(' ')); break;
  case 'edit': cmdEdit(rest[0], rest.slice(1).join(' ')); break;
  case 'find': cmdFind(rest.join(' ')); break;
  default:
    out({ ok: false, error: 'usage', commands: ['list', 'scan', 'add <text>', 'delete <id|text>', 'edit <id> <newtext>', 'find <query>'] });
}
