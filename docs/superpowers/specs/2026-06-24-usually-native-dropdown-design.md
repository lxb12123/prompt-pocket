# Design — `/usually` native dropdown across hosts (pick from the slash menu)

Date: 2026-06-24
Topic: Make `/usually` surface saved prompts directly in the host's native slash dropdown
on **Claude Code, OpenCode, and Codex**, so the user types the prefix, sees their phrases,
arrows to one, and presses Enter to run it — no round-trip, no numbers to type.

## Problem

Today `/usually` is a single command. The user types it, submits, and only *then* does
the model run a script and render a pick-menu. The saved phrases never appear in the `/`
dropdown itself. The placeholder also advertises `add|delete|edit|find`, foregrounding
management over the common case (run a usual prompt).

Desired UX: type `/usually` → the phrases appear inline in the dropdown → ⬆️/⬇️ to
cycle → Enter runs the selected phrase. The user wants this **unified across the hosts
they use**, not just Claude Code.

## Host capabilities (verified)

None of the three hosts support ghost-text / cyclable inline argument suggestions — that
exact look is impossible. But each has a **native `/` dropdown** (list → ⬆️/⬇️ → Enter
runs) that lists command/prompt files. So the pocket **generates one file per saved
prompt** into each host's command directory.

| | Claude Code | OpenCode | Codex |
|---|---|---|---|
| Type `/usually` filters to your prompts | ✅ `/usually:<slug>` | ✅ `/usually:<slug>` | ❌ only `/prompts:usually-<slug>` (fixed `prompts:` prefix; no subdir namespace) |
| Dropdown shows `description`, ⬆️/⬇️ + Enter runs | ✅ | ✅ | ✅ |
| Body sent as the prompt | ✅ | ✅ (`$ARGUMENTS`/`$1` placeholders exist) | ✅ (`$1`/`$ARGUMENTS`; `$$` = literal `$`) |
| Subdirectory namespace | ✅ colon | ✅ colon (use canonical plural `commands/`; singular `command/` is a backwards-compat alias) | ❌ subdirs ignored, flat only |
| Live reload after writing files | reopen `/` menu | ⚠️ may need session restart | ❌ restart / new chat required |
| Global dir | `~/.claude/commands/` | `~/.config/opencode/commands/` | `~/.codex/prompts/` |
| Owns a dedicated subdir? | ✅ `commands/usually/` | ✅ `commands/usually/` | ❌ **shared** `prompts/` dir |
| Status | normal | normal | ⚠️ custom prompts officially deprecated (still functional) |

Claude Code + OpenCode are genuinely unified (identical `/usually:<slug>` form, same
generation). Codex is best-effort: it can only ever surface them under `/prompts:usually-…`
and needs a restart to pick up changes — the user accepted this trade-off.

## Approach (chosen)

`pocket.mjs` gains a deterministic **`sync`** step that regenerates one file per saved
prompt into each installed host's command directory. After sync:

- **Claude Code / OpenCode** — typing `/usually` shows, natively:
  ```
  /usually:pullmainandr        pull main and rebuild the project          (12×)
  /usually:把这段中文文字翻译成英文   把这段中文文字翻译成英文并润色一下          (8×)
  ...
  ```
- **Codex** — typing `/prompts:usually` shows `/prompts:usually-pullmainandr`, etc.

⬆️/⬇️ cycles, Enter runs that exact phrase. The slug is a short, readable
fragment of the phrase — Latin or CJK, never a bare number; the full phrase + `(N×)` is always in the
`description`, so even if a slug renders oddly the phrase is visible.

## Components

### 1. `pocket.mjs sync` — multi-host command-file generator (new)

Driven by a small **targets table**, so adding/removing a host is one row:

| host | dir | guard (only if exists) | naming | owns dir? |
|---|---|---|---|---|
| claude | `~/.claude/commands/usually/` | `~/.claude/` | `<slug>.md` → `/usually:<slug>` | yes (dedicated subdir) |
| opencode | `~/.config/opencode/commands/usually/` | `~/.config/opencode/` | `<slug>.md` → `/usually:<slug>` | yes (dedicated subdir) |
| codex | `~/.codex/prompts/` | `~/.codex/` | `usually-<slug>.md` → `/prompts:usually-<slug>` | **no (shared)** |

For each target whose guard dir exists:
- **Source list:** the same `high` set `cmdList` computes —
  `count >= THRESHOLD || source === 'manual'`, sorted by count.
- **Idempotent rewrite, marker-gated:** every generated file carries a marker comment
  `<!-- prompt-pocket:generated -->`. On each sync, **delete only the files we generated**
  (marker present), then write the current set:
  - claude / opencode: the subdir is dedicated, but still delete only marker-bearing
    `*.md` (belt-and-suspenders).
  - **codex: the `prompts/` dir is SHARED** with the user's other prompts — delete only
    files matching `usually-*.md` **and** bearing the marker. Never touch anything else.
  Deletions in the pocket therefore drop their files automatically on next sync.
- **Per-prompt file** (`description` is what the dropdown shows beside the name):
  ```
  ---
  description: <full phrase>  (<count>×)
  ---
  <!-- prompt-pocket:generated -->
  Run this saved Prompt Pocket prompt exactly as if the user just typed it — execute it
  now; do not echo it back or ask whether to proceed:

  <full phrase>
  ```
  When the command runs, the body becomes the prompt → the phrase runs verbatim, no extra
  script call. **`$` escaping:** OpenCode and Codex treat `$NAME`/`$1`/`$ARGUMENTS` in the
  body as placeholders. If a phrase contains a literal `$`, escape it for those two targets
  (Codex: `$` → `$$`; OpenCode: break the `$word` pattern, e.g. zero-width or `\$` per its
  rules). Claude Code needs no escaping. (Low risk for these build prompts, but handle it.)

- **Slug algorithm `slugOf(text)`** — readable, filesystem-safe, deterministic:
  1. `norm(text)`, keep only CJK / Latin letters / digits; drop whitespace, punctuation,
     and the FS-reserved set `/ \ : * ? " < > |` and control chars.
  2. Truncate to ~12 characters.
  3. If empty after stripping (emoji-only), fall back to the 8-char `idOf(text)`.
  4. **Uniqueness within a run:** if a slug is already taken, append `-2`, `-3`, … The
     numeric suffix appears only on genuine collision, not by default.
  Same text → same slug across runs (suffix aside), so files stay stable.
  Chinese slugs are fine on macOS for claude/opencode; Windows risk is out of scope.

- **Return value:** `sync` prints
  `{ ok, action:'sync', byHost:{ claude:{written,dir}|{skipped}, opencode:…, codex:… } }`.

### 2. Wire `sync` into every mutation

Call the generator at the end of `cmdScan`, `cmdAdd`, `cmdEdit`, `cmdDelete` so every host
dropdown is current after any change. Each JSON output gains `commandsWritten` (total).
`sync` is also a standalone command (`pocket.mjs sync`) for first-time setup / repair.
Generation is wrapped in try/catch per target — a failed host is reported, never thrown,
and never breaks the core mutation or the other hosts.

### 3. Bare `/usually` becomes "refresh + manage"

Bare `/usually` (no sub-action) now:
1. runs `scan` (which also syncs all hosts) to refresh frequencies + every dropdown,
2. tells the user briefly: dropdowns refreshed — *type `/usually:` (Claude Code/OpenCode)
   or `/prompts:usually` (Codex) to pick a saved prompt* — plus `addedCount` if any new
   prompts were recorded, plus a note that Codex needs a restart to see changes,
3. still renders the inline pick-menu as a **fallback** (works on every host, and for a
   user who'd rather pick here than reopen the dropdown).

`add / delete / edit / find` sub-actions keep their behavior; they now also refresh every
dropdown via the wired-in sync.

### 4. Command/skill doc updates

- `commands/usually.md`, `.claude/commands/usually.md`, `.opencode/commands/usually.md`,
  and the plugin copy: rewrite `argument-hint` to be inviting and dropdown-aware
  (`"type /usually: to run a saved prompt · or add|find|edit|delete"`); update
  `description` to mention the dropdown.
- `skills/usually/prompt.md` and `skills/usually/SKILL.md` (+ mirrored copies under
  `.claude/`, `.agents/`, `.opencode/`, `.cursor`): document the `sync` step, the three
  target dirs and which are owned vs shared, the per-host invocation forms and live-reload
  caveats, and the new bare-`/usually` "refresh + manage + fallback pick" flow.
- `skills/usually/reference/store-and-scan.md` and `README.md`: document the generated
  dropdowns, the owned/shared directories, the slug scheme, the `$`-escape rule, and the
  first-run note (a host's dropdown appears after the first `/usually` / scan populates it,
  and on Codex only after a restart).

## Data flow

```
user runs /usually (or add/edit/delete/scan)
        │
        ▼
pocket.mjs <cmd>  ──mutates──►  ~/.prompt-pocket/store.json
        │
        └─ regenCommands(high)  ──for each installed host──►
              ~/.claude/commands/usually/<slug>.md            → /usually:<slug>
              ~/.config/opencode/commands/usually/<slug>.md     → /usually:<slug>
              ~/.codex/prompts/usually-<slug>.md               → /prompts:usually-<slug>
                                                        │
                              host scans its command dir → dropdown entries
                                                        │
                              user types prefix → dropdown → ⬆️/⬇️ → Enter
                                                        │
                              command body = phrase → model executes it
```

## Error handling

- Host guard dir missing → skip that host silently, report `skipped:'no-<host>-dir'`. Other
  hosts and the core command still succeed.
- A target throws (perms, disk) → caught per host; mutation result still returned with that
  host's `written:0` + an error note. Never fail the user's actual action.
- Slug collisions → numeric suffix (`-2`…). Emoji/punct-only phrase → `idOf` fallback.
- Shared Codex dir → marker + `usually-` prefix gate ensures we never delete the user's own
  prompts.
- Literal `$` in a phrase → escaped for OpenCode/Codex bodies.

## Testing

- `slugOf`: ASCII, Chinese, mixed, punctuation/space stripping, ~12-char truncation,
  emoji-only fallback, collision suffixing.
- `sync` per host: writes N files for N high prompts; deletes only marker-bearing files;
  Codex deletion gated by `usually-` prefix (a planted non-`usually` prompt survives);
  missing-host-dir skip path; idempotent (two runs → identical set).
- Generated file shape: valid frontmatter, marker present, body contains the exact phrase;
  `$`-escaping applied for opencode/codex, not for claude.
- Wiring: `add`/`edit`/`delete`/`scan` each leave every installed host's dir consistent
  with the store and report `commandsWritten`.
- Manual end-to-end: Claude Code `/usually` and OpenCode `/usually` dropdowns list the
  phrases and selecting one runs it; Codex `/prompts:usually` lists them after a restart.

## Non-goals

- Ghost-text / cyclable inline suggestions in the input box (no host supports it).
- Controlling dropdown sort order — host-controlled (likely alphabetical by name);
  frequency is shown in each `description` instead. Forcing frequency order would need
  numeric name prefixes, which the user rejected. (User accepted host ordering.)
- A true `/usually` namespace on Codex — structurally impossible; `/prompts:usually-…` is
  the accepted form there.
- Windows-safe (ASCII/pinyin) slugs — user is on macOS; revisit only if Windows is needed.
