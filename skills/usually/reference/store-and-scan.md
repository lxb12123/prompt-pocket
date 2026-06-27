# Prompt Pocket — store & scan rules (read on demand)

## Store location
`~/.prompt-pocket/store.json` — **host-neutral, shared across agents**: Claude / Codex /
etc. all read and write the same pocket. On first run, if a legacy store is found at
`~/.claude/prompt-pocket/store.json`, it is migrated automatically.

## Data shape
```json
{
  "version": 1,
  "prompts": [
    {
      "id": "a1b2c3d4",          // sha1 of the normalized text, first 8 chars; text changes -> id changes
      "text": "the prompt text",
      "count": 12,               // occurrences (real cumulative frequency across all agents)
      "source": "auto",          // auto = recorded by scan / manual = added by the user
      "createdAt": "ISO time",
      "updatedAt": "ISO time"
    }
  ]
}
```

## Frequency scan — cross-agent
For each agent present on the machine, a "human input only" rule extracts typed prompts;
counts are merged across agents:

| Agent | Session store | Event taken | Text taken |
|---|---|---|---|
| Claude Code | `~/.claude/projects/**/*.jsonl` | `type:"user"` with `promptSource:"typed"` | `message.content` (string or text blocks) |
| Codex CLI | `~/.codex/sessions/**/*.jsonl` | `type:"event_msg"` with `payload.type:"user_message"` | `payload.message` |
| OpenCode | `~/.local/share/opencode/opencode.db` (SQLite, via `node:sqlite`) | `part` rows with `data.type:"text"` whose parent `message.data.role:"user"` | `data.text` |

- All sources go through the same `cleanCandidate`: collapse whitespace, strip a pasted prompt
  glyph (`❯ ` / `› ` / `> `), skip length < 3, skip lines starting with `/` (slash
  commands) or `#` (Codex injects "# Files mentioned…"), and skip noise containing
  `<command…>` / `<system-reminder>` / `Caveat:` / `[Request interrupted`.
- Counting key = lower-cased normalized text (case-insensitive).
- **Threshold = 7**: once the same normalized text occurs >= 7 times in total across all
  agents, it is auto-recorded with `source:"auto"`.

> Note: Claude's jsonl has `promptSource`, which pinpoints genuinely human-typed input.
> Codex and OpenCode have no equivalent field, so they rely on `cleanCandidate` to filter
> injected content — slightly higher noise tolerance, but threshold 7 filters out the
> occasional noise. The OpenCode reader uses Node's `node:sqlite` (Node 22+) read-only and
> is wrapped in try/catch: a missing API, a locked db, or a schema change degrades silently
> (OpenCode is skipped) and never breaks the Claude/Codex scan. To support another agent,
> just add one more `xxxTexts()` reader per
> the table above; nothing else changes.

## list semantics
- `all`: every prompt, sorted by `count` descending.
- `high` (the set shown in the "pocket") = `count >= 7` **or** `source == "manual"`.
  i.e. scanned high-frequency items plus prompts the user explicitly `add`-ed (manual
  items show even with a low count).

## Native dropdown (generated command files)
`sync` (run automatically at the end of `scan`/`add`/`edit`/`delete`, or on demand)
writes one command/prompt file per `high` prompt into each installed host's command dir,
so the saved prompts appear directly in the host's native `/` dropdown (arrow-pick, Enter
runs). Per host:

| Host | Generated path | Invoked as | Dir ownership | Live reload |
|---|---|---|---|---|
| Claude Code | `~/.claude/commands/usually/<slug>.md` | `/usually:<slug>` | dedicated (ours) | reopen the `/` menu |
| OpenCode | `~/.config/opencode/commands/usually/<slug>.md` | `/usually:<slug>` | dedicated (ours) | may need a session restart |
| Codex | `~/.codex/prompts/usually-<slug>.md` | `/prompts:usually-<slug>` | **shared** with the user's own prompts | restart / new chat required |

- `<slug>` keeps only letters (incl. CJK) and digits from the text, takes ~16 chars but
  extends through a trailing ASCII word instead of cutting it mid-token (hard cap 28),
  falling back to the 8-char id if nothing is keepable; a numeric `-N` suffix is added only
  on a same-run collision. The slug **is** the dropdown label, so it's made readable on its
  own. The file's `description` is kept generic (`Run this saved Prompt Pocket prompt`) on
  purpose: it's the only part preloaded into every session, so the full prompt is never put
  there — the full text lives in the body and runs when the entry is picked.
- Each generated file carries the marker `<!-- prompt-pocket:generated -->`. **Only marked
  files are ever deleted.** Codex's dir is shared, so deletion there is additionally gated
  by the `usually-` filename prefix — the user's hand-written prompts are never touched.
- For OpenCode/Codex the body escapes a literal `$` (→ `$$`) so a phrase is never mistaken
  for a `$NAME`/`$1` placeholder; Claude Code needs no escaping.
- First-run note: a host's entries appear after the first `/usually` (or `scan`) populates
  them; on Codex they appear only after you restart Codex.
- Generation is wrapped per host: a missing host dir is skipped (`skipped:"no-<host>-dir"`)
  and any write error is reported, never thrown — it can't break the core command.

## Want to change the threshold?
Edit the single `const THRESHOLD = 7;` at the top of `scripts/pocket.mjs`; both list and
scan pick it up.
