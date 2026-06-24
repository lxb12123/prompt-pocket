# Design — `/usually` native dropdown (pick from the slash menu)

Date: 2026-06-24
Topic: Make `/usually` surface saved prompts directly in Claude Code's native slash
dropdown, so the user types `/usually`, sees their phrases, arrows to one, and presses
Enter to run it — no round-trip, no numbers to type.

## Problem

Today `/usually` is a single command. The user types it, submits, and only *then* does
the model run a script and render a pick-menu. The saved phrases never appear in the `/`
dropdown itself. The placeholder also advertises `add|delete|edit|find`, foregrounding
management over the common case (run a usual prompt).

The user's desired UX: type `/usually` → the phrases appear inline → ⬆️/⬇️ to cycle →
Enter runs the selected phrase.

## Host constraint (verified)

Claude Code's input box has **no** ghost-text / dynamic-suggestion / cyclable-argument
API. `argument-hint` is static text only. No hook/MCP/plugin can inject runtime
suggestions into the input line. So the *pure* ghost-text version is impossible.

The **native `/` dropdown**, however, already does "see a list → ⬆️/⬇️ cycle → Enter
runs," and it lists every command file — including namespaced subcommands in a
subdirectory. So we make the pocket **generate one subcommand file per saved prompt**.

## Approach (chosen)

`pocket.mjs` gains a deterministic **`sync`** step that regenerates one tiny command file
per saved prompt under Claude Code's user-level command dir. After sync, typing `/usually`
shows, natively:

```
/usually                       refresh + manage (add / find / edit / delete)
/usually:pullmainandr   把这段中文文字翻译成英文并润色一下   (16次)
/usually:rebuild      pull main and rebuild the project    (13次)
/usually:rebuild      pull main and rebuild the project  (9次)
...
```

⬆️/⬇️ cycles, Enter runs that exact phrase. This is the closest achievable to the
user's vision; the only unavoidable compromise is the visible `usually:<slug>` command
name (structurally required for the entries to appear when typing `/usually`). The slug is
a short, readable Chinese fragment of the phrase — never a bare number.

## Components

### 1. `pocket.mjs sync` — command-file generator (new)

- **Target dir (owned by Prompt Pocket):** `~/.claude/commands/usually/`.
  Guard: only generate if `~/.claude/` exists (i.e. Claude Code is installed). Otherwise
  skip silently — never fail the core command. (OpenCode/Codex dropdown generation is
  explicitly out of scope for this spec; see Non-goals.)
- **Source list:** the same `high` set `cmdList` computes —
  `count >= THRESHOLD || source === 'manual'`, sorted by count.
- **Idempotent rewrite:** the dir is exclusively ours. On each sync, delete every existing
  `*.md` in it, then write the current set. Deletions in the pocket therefore drop their
  command files automatically. As a safety belt, every generated file carries a marker
  comment `<!-- prompt-pocket:generated -->`; sync only deletes `*.md` files that contain
  this marker, so a stray user file in the dir is never clobbered.
- **Per-prompt file** `~/.claude/commands/usually/<slug>.md`:
  ```
  ---
  description: <full phrase>  (<count>次)
  ---
  <!-- prompt-pocket:generated -->
  Run this saved Prompt Pocket prompt exactly as if the user just typed it — execute it
  now; do not echo it back or ask whether to proceed:

  <full phrase>
  ```
  The `description` is what the dropdown shows beside the command name. The body, when the
  command runs, becomes the prompt — so selecting the entry runs the phrase verbatim with
  no extra script call.

- **Slug algorithm `slugOf(text)`** — readable, filesystem-safe, deterministic:
  1. `norm(text)`, then keep only CJK / Latin letters / digits; drop whitespace,
     punctuation, and the FS-reserved set `/ \ : * ? " < > |` and control chars.
  2. Truncate to ~12 characters.
  3. If empty after stripping (e.g. emoji-only), fall back to the 8-char `idOf(text)`.
  4. **Uniqueness:** if the slug is already taken this run, append `-2`, `-3`, … The
     numeric suffix appears only on genuine collision, not by default.
  Same text → same slug across runs (suffix aside), so files stay stable.

- **Return value:** `sync` prints `{ ok, action:'sync', dir, written:<n>, skipped:<reason?> }`.

### 2. Wire `sync` into every mutation

Call the generator at the end of `cmdScan`, `cmdAdd`, `cmdEdit`, `cmdDelete` so the
dropdown is always current after any change. Each of those JSON outputs gains a
`commandsWritten: <n>` field for transparency. `sync` is also exposed as a standalone
command (`pocket.mjs sync`) for first-time setup / repair. Generation is wrapped in
try/catch and can never break the core mutation (a failed sync is reported, not thrown).

### 3. Bare `/usually` becomes "refresh + manage"

Bare `/usually` (no sub-action) now:
1. runs `scan` (which also syncs) to refresh frequencies + the dropdown,
2. tells the user briefly: dropdown refreshed — *type `/usually:` to pick a saved prompt*,
   plus `addedCount` if any new prompts were recorded,
3. still renders the inline pick-menu as a **fallback** (hosts without the dropdown, or a
   user who'd rather pick here). So cross-host behavior is preserved; the dropdown is a
   Claude-Code enhancement layered on top.

`add / delete / edit / find` sub-actions are unchanged in behavior; they now also refresh
the dropdown via the wired-in sync.

### 4. Command/skill doc updates

- `commands/usually.md`, `.claude/commands/usually.md`, `.opencode/commands/usually.md`,
  and the plugin copy: rewrite `argument-hint` to be inviting and dropdown-aware, e.g.
  `"type /usually: to run a saved prompt · or add|find|edit|delete"`, and update
  `description` to mention the dropdown.
- `skills/usually/prompt.md` and `skills/usually/SKILL.md` (+ mirrored copies under
  `.claude/`, `.agents/`, `.opencode/`, `.cursor`): document the `sync` step, the
  `~/.claude/commands/usually/` ownership, and the new bare-`/usually` "refresh + manage +
  fallback pick" flow.
- `skills/usually/reference/store-and-scan.md` and `README.md`: document the generated
  dropdown, the owned directory, the slug scheme, and the first-run note (the dropdown
  appears after the first `/usually` / scan populates it).

## Data flow

```
user runs /usually (or add/edit/delete/scan)
        │
        ▼
pocket.mjs <cmd>  ──mutates──►  ~/.prompt-pocket/store.json
        │
        └─ regenCommands(high)  ──writes──►  ~/.claude/commands/usually/<slug>.md  (one per prompt)
                                                        │
                                                        ▼
                              Claude Code scans command dir → /usually:<slug> entries
                                                        │
                              user types /usually → dropdown → ⬆️/⬇️ → Enter
                                                        │
                              command body = phrase → model executes it
```

## Error handling

- No `~/.claude/` → skip generation silently, report `skipped:'no-claude-dir'`. Core
  command still succeeds.
- Generation throws (perms, disk) → caught; mutation result still returned with
  `commandsWritten:0` and an error note. Never fail the user's actual action.
- Slug collisions → numeric suffix (`-2`…). Emoji/punct-only phrase → `idOf` fallback.
- Stray non-generated `*.md` in the owned dir → preserved (marker-gated deletion).

## Testing

- `slugOf`: ASCII, Chinese, mixed, punctuation/space stripping, ~12-char truncation,
  emoji-only fallback, collision suffixing.
- `sync`: writes N files for N high prompts; deletes files for removed prompts; only
  touches marker-bearing files; no-`~/.claude` skip path; idempotent (two runs → same set).
- Generated file shape: valid frontmatter, marker present, body contains the exact phrase.
- Wiring: `add`/`edit`/`delete`/`scan` each leave the dir consistent with the store and
  report `commandsWritten`.
- Manual end-to-end on Claude Code: after `/usually`, `/usually` dropdown lists the
  phrases; selecting one runs that phrase.

## Non-goals

- Ghost-text / cyclable inline suggestions in the input box (host can't do it).
- Controlling dropdown sort order — it's host-controlled (likely alphabetical by command
  name); frequency is shown in each description instead. Forcing frequency order would
  require numeric name prefixes, which the user rejected. Out of scope.
- OpenCode / Codex dropdown generation. The runtime pick-menu remains their path; native
  dropdown generation for them can be a later, separately-verified addition (the target
  dir is the only thing that differs, so the generator is structured to make this easy).
