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
      "count": 16,               // occurrences (real cumulative frequency across all agents)
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

## Want to change the threshold?
Edit the single `const THRESHOLD = 7;` at the top of `scripts/pocket.mjs`; both list and
scan pick it up.
