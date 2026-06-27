#!/usr/bin/env node
// Prompt Pocket — deterministic store + cross-agent transcript scanner (0-token core).
// All state-changing logic lives here so the LLM never has to "remember" data.
//
// Store:  ~/.prompt-pocket/store.json   (host-neutral, shared by every agent)
// Scan sources (whichever exist on the machine):
//   - Claude Code:  ~/.claude/projects/**/*.jsonl              (type:user, promptSource:typed)
//   - Codex CLI:    ~/.codex/sessions/**/*.jsonl                (event_msg, payload.type:user_message)
//   - OpenCode:     ~/.local/share/opencode/opencode.db         (SQLite: part.text where message.role=user)
//
// Usage:  node skills/usually/scripts/pocket.mjs <command> [args]
//   list                     list prompts (sorted by count; high-frequency flagged)
//   scan                     scan transcripts from all agents, auto-record prompts said >= THRESHOLD
//   add   <text...>          manually record a prompt
//   delete <id|text...>      remove a prompt
//   edit  <id> <newtext...>  change a prompt's text
//   find  <query...>         search prompts by substring
// Output is always a single JSON object on stdout.

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync, unlinkSync, rmdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const THRESHOLD = 7;                       // auto-record once a prompt is repeated this many times
const HOME = process.env.PROMPT_POCKET_HOME || homedir();
const STORE_DIR = join(HOME, '.prompt-pocket');
const STORE = join(STORE_DIR, 'store.json');
const LEGACY_STORE = join(HOME, '.claude', 'prompt-pocket', 'store.json');  // migrate-from

const nowISO = () => new Date().toISOString();
const out = (o) => process.stdout.write(JSON.stringify(o, null, 2) + '\n');

const norm = (t) => String(t).replace(/\s+/g, ' ').trim();
const keyOf = (t) => norm(t).toLowerCase();
const idOf = (t) => createHash('sha1').update(keyOf(t)).digest('hex').slice(0, 8);

// Readable, filesystem-safe, deterministic slug from a prompt's text. This is the LABEL
// shown in the /usually: dropdown (the command description is now generic — see
// fileMarkdown), so it has to be recognizable. Keeps letters (incl. CJK via \p{L}) and
// digits, drops everything else, then takes ~16 chars but never cuts an ASCII word in
// half — it extends to the word's end (hard-capped at 28). So a slug reads like
// "你帮我拉取Egonexflutter" instead of the old mid-token "你帮我拉取Egonexf".
function slugOf(text) {
  const chars = [...norm(text).replace(/[^\p{L}\p{N}]/gu, '')];   // code-point aware
  if (!chars.length) return idOf(text);
  const TARGET = 16, MAX = 28;
  if (chars.length <= TARGET) return chars.join('');
  const isWord = (c) => c !== undefined && /[A-Za-z0-9]/.test(c);
  let end = TARGET;
  if (isWord(chars[end - 1]) && isWord(chars[end])) {             // landed mid ASCII word
    while (end < chars.length && end < MAX && isWord(chars[end])) end++;   // finish it
  }
  return chars.slice(0, end).join('');
}
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

// OpenCode: stores sessions in SQLite. User text = part rows (data.type === 'text')
// whose parent message has data.role === 'user'. Uses node:sqlite (Node 22+), read-only.
// Wrapped so a missing API, locked db, or schema drift degrades silently (skip OpenCode).
function opencodeTexts() {
  const db = join(HOME, '.local', 'share', 'opencode', 'opencode.db');
  if (!existsSync(db)) return [];
  const texts = [];
  try {
    const require = createRequire(import.meta.url);
    const { DatabaseSync } = require('node:sqlite');
    const conn = new DatabaseSync(db, { readOnly: true });
    const rows = conn.prepare(
      `SELECT json_extract(p.data, '$.text') AS text
         FROM part p JOIN message m ON p.message_id = m.id
        WHERE json_extract(m.data, '$.role') = 'user'
          AND json_extract(p.data, '$.type') = 'text'
          AND json_extract(p.data, '$.text') IS NOT NULL`
    ).all();
    conn.close();
    for (const r of rows) {
      const t = cleanCandidate(r.text);
      if (t) texts.push(t);
    }
  } catch {
    return [];   // node:sqlite unavailable / db locked / schema changed — skip OpenCode, never fail the scan
  }
  return texts;
}

// ---- generated host command files -----------------------------------------
const GEN_MARKER = '<!-- prompt-pocket:generated -->';

// One row per host with a native slash dropdown. `owned` dirs are exclusively ours;
// `prefix` (codex only) gates deletion in a SHARED dir. `esc` escapes `$` for hosts
// that treat $NAME/$1 as placeholders.
const TARGETS = [
  { host: 'claude',
    guard: join(HOME, '.claude'),
    dir: join(HOME, '.claude', 'commands', 'usually'),
    name: (slug) => `${slug}.md`, esc: false,
    managerPath: join(HOME, '.claude', 'commands', 'usually.md') },
  { host: 'opencode',
    guard: join(HOME, '.config', 'opencode'),
    dir: join(HOME, '.config', 'opencode', 'commands', 'usually'),
    name: (slug) => `${slug}.md`, esc: true,
    managerPath: join(HOME, '.config', 'opencode', 'commands', 'usually.md'),
    // OpenCode's canonical dir is plural `commands/`; older builds of this tool wrote to
    // singular `command/` (a backwards-compat alias OpenCode still reads). Clean those up so
    // users don't end up with duplicate /usually: entries served from both directories.
    legacy: { dir: join(HOME, '.config', 'opencode', 'command', 'usually'),
              managerPath: join(HOME, '.config', 'opencode', 'command', 'usually.md') } },
  { host: 'codex',
    guard: join(HOME, '.codex'),
    dir: join(HOME, '.codex', 'prompts'),
    name: (slug) => `usually-${slug}.md`, prefix: 'usually-', esc: true },
  // Codex has no bare-command concept (everything is /prompts:…), so no manager command.
];

// A bare `/usually` manager command (user-level, so it renders argument-hint — unlike
// plugin commands, which hit the #46626 no-hint bug). Marker-gated: created if absent,
// refreshed if we own it, never overwriting a user-authored usually.md.
function managerMarkdown() {
  const desc = 'Prompt Pocket — list your saved prompts and pick one to run; manage with ' +
    'add/find/edit/delete. Type /usually: to run a saved prompt directly from the dropdown.';
  const hint = 'type /usually: to run a saved prompt · or add|find|edit|delete';
  return `---\ndescription: ${JSON.stringify(desc)}\nargument-hint: ${JSON.stringify(hint)}\n---\n` +
    `${GEN_MARKER}\nUse the **usually** skill (Prompt Pocket) to handle this request by running ` +
    `\`node ~/.prompt-pocket/pocket.mjs <command>\`. Map the user's input to a sub-action:\n` +
    `- empty / "list" / "列出" -> \`list\`, then let them pick one and run it on their behalf.\n` +
    `- "add"/"save"/"存"/"记一下" -> \`add <text>\`.\n` +
    `- "find"/"search"/"搜"/"找" -> \`find <keyword>\`.\n` +
    `- "edit"/"update"/"change"/"改"/"修改" -> \`edit <id> <new text>\`.\n` +
    `- "delete"/"remove"/"rm"/"删"/"删除" -> \`delete <id|text>\`.\n` +
    `When you show the list (for picking, editing, or deleting), **display each prompt with its ` +
    `short 8-char \`id\` and \`(N×)\` count** so the user can copy an id for edit/delete. ` +
    `\`edit\`/\`delete\` need an id (a unique id-prefix or exact text also works); if the user ` +
    `asked to edit/delete without one, run \`list\` first and ask which id. If the input matches ` +
    `no sub-action, don't go silent — show the supported commands.\n\n` +
    `The user's input this turn (may be empty = list and pick one to run):\n\n$ARGUMENTS\n`;
}

function regenManager(t) {
  if (!t.managerPath) return {};
  try {
    if (existsSync(t.managerPath)) {
      const cur = readFileSync(t.managerPath, 'utf8');
      if (!cur.includes(GEN_MARKER)) return { manager: 'kept-user-file' };   // never clobber
    }
    mkdirSync(dirname(t.managerPath), { recursive: true });
    writeFileSync(t.managerPath, managerMarkdown());
    return { manager: t.managerPath };
  } catch (e) {
    return { managerError: String((e && e.message) || e) };
  }
}

function highPrompts(store) {
  return sortByCount(store.prompts).filter(
    (p) => (p.count || 0) >= THRESHOLD || p.source === 'manual');
}

// The `description` is the ONLY part of a generated command that Claude / OpenCode preload
// into EVERY session's context (the picker shows it as a hint). So we keep it generic and
// tiny and NEVER put the (possibly long) prompt text here — that was the always-on context
// cost. The full prompt lives only in the body, which is injected on demand when the
// command actually runs. The visible dropdown label comes from the filename (see slugOf),
// so a generic description costs nothing the user can see.
function fileMarkdown(text, esc) {
  const desc = 'Run this saved Prompt Pocket prompt';
  const body = esc ? text.replace(/\$/g, '$$$$') : text;   // $$$$ -> literal $$ in output
  return `---\ndescription: ${JSON.stringify(desc)}\n---\n${GEN_MARKER}\n` +
    `Run this saved Prompt Pocket prompt exactly as if the user just typed it — execute ` +
    `it now; do not echo it back or ask whether to proceed:\n\n${body}\n`;
}

// Remove files we generated under a host's *previous* directory layout (marker-gated, so a
// user-authored file is never touched). Used when a host's canonical dir name changes.
function cleanupLegacy(t) {
  if (!t.legacy) return;
  const { dir, managerPath } = t.legacy;
  try {
    if (existsSync(dir)) {
      for (const f of readdirSync(dir)) {
        if (!f.endsWith('.md')) continue;
        const full = join(dir, f);
        let content = '';
        try { content = readFileSync(full, 'utf8'); } catch { continue; }
        if (content.includes(GEN_MARKER)) { try { unlinkSync(full); } catch {} }
      }
      try { if (readdirSync(dir).length === 0) rmdirSync(dir); } catch {}   // only if now empty
    }
    if (managerPath && existsSync(managerPath)) {
      let content = '';
      try { content = readFileSync(managerPath, 'utf8'); } catch {}
      if (content.includes(GEN_MARKER)) { try { unlinkSync(managerPath); } catch {} }
    }
  } catch {}
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
      writeFileSync(join(t.dir, t.name(s)), fileMarkdown(p.text, t.esc));
      written++;
    }
    cleanupLegacy(t);
    return { written, dir: t.dir, ...regenManager(t) };
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

// Build the extra output fields every mutating command appends.
function regenFields(store) {
  const byHost = safeRegen(store);
  const commandsWritten = Object.values(byHost)
    .reduce((n, r) => n + (r && typeof r.written === 'number' ? r.written : 0), 0);
  return { byHost, commandsWritten };
}

// ---- commands -------------------------------------------------------------

function cmdScan() {
  const bySource = { claude: claudeTexts(), codex: codexTexts(), opencode: opencodeTexts() };
  const texts = [...bySource.claude, ...bySource.codex, ...bySource.opencode];
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
    bySource: { claude: bySource.claude.length, codex: bySource.codex.length, opencode: bySource.opencode.length },
    addedCount: added.length, updatedCount: updated.length, added, updated,
    ...regenFields(store),
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
  out({ ok: true, action: 'add', prompt: p, ...regenFields(store) });
}

function cmdDelete(idOrText) {
  const q = norm(idOrText);
  if (!q) return out({ ok: false, error: 'missing id or text' });
  const store = loadStore();
  const p = findPrompt(store, q);
  if (!p) return out({ ok: false, error: 'not found', query: q });
  store.prompts = store.prompts.filter((x) => x.id !== p.id);
  saveStore(store);
  out({ ok: true, action: 'delete', removed: p, ...regenFields(store) });
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
  out({ ok: true, action: 'edit', before, after: p, ...regenFields(store) });
}

function cmdFind(query) {
  const q = keyOf(query);
  if (!q) return out({ ok: false, error: 'empty query' });
  const store = loadStore();
  const matches = sortByCount(store.prompts.filter((p) => keyOf(p.text).includes(q)));
  out({ ok: true, action: 'find', query: norm(query), count: matches.length, matches });
}

// ---- dispatch -------------------------------------------------------------

function main() {
  const [, , cmd, ...rest] = process.argv;
  switch (cmd) {
    case 'list': cmdList(); break;
    case 'scan': cmdScan(); break;
    case 'add': cmdAdd(rest.join(' ')); break;
    case 'delete': cmdDelete(rest.join(' ')); break;
    case 'edit': cmdEdit(rest[0], rest.slice(1).join(' ')); break;
    case 'find': cmdFind(rest.join(' ')); break;
    case 'sync': { const store = loadStore(); out({ ok: true, action: 'sync', byHost: safeRegen(store) }); break; }
    default:
      out({ ok: false, error: 'usage', commands: ['list', 'scan', 'add <text>', 'delete <id|text>', 'edit <id> <newtext>', 'find <query>', 'sync'] });
  }
}

export { slugOf, regenCommands };

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
