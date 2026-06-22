---
name: usually
description: Prompt Pocket — remembers your most-used prompts and lets you pick one to run instantly. Auto-records prompts you repeat >= 7 times across agent sessions, plus manual add/delete/edit/find. Pick-to-run and manual management work on every host; auto-scan covers Claude Code, Codex and OpenCode sessions. Use when the user wants to list or reuse their frequent prompts (e.g. "/usually", "list my usual prompts", "what do I usually say", or in Chinese "列一下我常用的" / "我平时常说啥"), or to add / delete / edit / find a saved prompt.
---

# /usually — Prompt Pocket

Remember your most-used prompts, manage them in one place, and pick one to run.
All data and frequency counting are done by a deterministic script (0 tokens);
your only job is: decide the sub-action → call the script → let the user pick from
a menu → run the picked prompt.

**Core script (every command prints a single JSON object — just relay it):**
`node skills/usually/scripts/pocket.mjs <command>`, run from the project root.
Store lives at `~/.prompt-pocket/store.json` (user-level, **shared across agents**:
Claude / Codex / OpenCode read the same pocket).
`scan` reads Claude (`~/.claude/projects`), Codex (`~/.codex/sessions`) and OpenCode
(`~/.local/share/opencode/opencode.db`) session history.

---

## First, decide which sub-action the user wants

From what the user said this turn (could be `/usually`, `/usually add ...`, or natural
language) pick one:

| User intent | Sub-action |
|---|---|
| just `/usually`, "list my usual prompts", "what do I usually say", "列一下我常用的" | **list + pick to run** (main flow, below) |
| "save this", "add this one", "remember this for later" | **add** |
| "delete that one", "remove …", "delete" | **delete** |
| "change that one", "rename … to …", "edit" | **edit** |
| "is there a … one", "find …", "did I say … before" | **find** |

---

## Main flow: list + pick to run

1. **Refresh frequencies** (scan transcripts, auto-record prompts repeated >= 7 times):
   ```
   node skills/usually/scripts/pocket.mjs scan
   ```
   Briefly tell the user how many new prompts were recorded this time (`addedCount`).

2. **Get the list**:
   ```
   node skills/usually/scripts/pocket.mjs list
   ```
   Use the returned `high` array (high-frequency + manually saved prompts). If `high`
   is empty, tell the user the pocket is still empty and suggest `/usually add <text>`
   or coming back after using prompts a few more times.

3. **Let the user pick** (prefer the host's native selection menu for the best UX):
   - **If the host has a native selection UI**: render each prompt in `high` as an option
     (use the text as the label; if it's long, truncate and put the full text + a `12x`
     frequency in the description). This is the "arrow-key select, press enter" experience.
   - **If the host has no native selection UI** (e.g. Codex / OpenCode TUI): **list them
     numbered** (`1) 16x <text>…`) and let the user reply with a number.
   Either way, the chosen prompt flows into step 4.

4. **Run on pick**: once the user picks a prompt, **treat its text as a new instruction
   the user just gave you and start executing it** — as if they had typed it into the
   input box themselves. Don't just echo it, don't ask "should I?" — picking IS the
   confirmation.

---

## Sub-actions

**add** — save a prompt the user explicitly gave you:
```
node skills/usually/scripts/pocket.mjs add "<prompt text>"
```
Extract the text from what the user said this turn (drop lead-ins like "remember"/"add").
If it already exists it's flagged as `manual`. Report added / already-existing.

**delete** — remove one. Confirm which first:
- If the user gave text/keywords → `find` it first to get the `id`, confirm there's no
  ambiguity, then delete.
- Then: `node skills/usually/scripts/pocket.mjs delete "<id or text>"`
Report the removed entry; on `not found` tell the user nothing matched.

**edit** — change a prompt's text:
1. `find` first to get the `id` of the one to change.
2. `node skills/usually/scripts/pocket.mjs edit <id> "<new prompt>"`
Report `before` / `after`. (Note: the `id` changes with the new text.)

**find** — check whether a prompt is in the pocket:
```
node skills/usually/scripts/pocket.mjs find "<keyword>"
```
List `matches` (already sorted by frequency); on `count: 0` say plainly it isn't there.

---

## Principles
- The script is the single source of truth: all create/read/update/delete and frequency
  go through it — never "remember" the data yourself.
- Before delete/edit, if there's ambiguity (multiple matches), list them and let the user
  confirm before acting.
- Pick-to-run is the soul of this skill: after the user picks, don't stop at echoing —
  start doing the work.
