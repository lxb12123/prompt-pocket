# Mirror sync generator + Gemini host — design

Date: 2026-06-27

## Problem

The `/usually` skill is authored once in **canonical** `skills/usually/SKILL.md` and
mirrored into one directory per host:

| Host | Mirror path | Differences from canonical |
|---|---|---|
| Claude Code | `.claude/skills/usually/SKILL.md` | none (identical) |
| OpenCode | `.opencode/skills/usually/SKILL.md` | `name: usually` frontmatter; manual-cp install section |
| Codex / Copilot (shared `.agents`) | `.agents/skills/usually/SKILL.md` | `name: usually`; manual-cp install |
| Cursor | `.cursor/rules/usually.mdc` | `alwaysApply: false` frontmatter; manual-cp install |

These mirrors were originally emitted by an external "Agent Path Forge" (`gene`)
compiler, but that CLI is not installed here and is not part of the working loop —
so mirrors are maintained **by hand**. Result: editing canonical without manually
copying into every mirror causes silent drift (it already happened twice today:
the numbered-`seq` paragraph and the one-click-update wording landed only in canonical).

Two gaps:

1. **No guard against drift.** Nothing regenerates mirrors or fails when they diverge.
2. **Gemini not wired as a first-class project host.** Note: `.gene/` is the Forge
   compiler's metadata (`geneVersion`/`fingerprint`), **not** a Gemini skill dir.
   Gemini CLI reads skills from `~/.gemini/skills/` (with `~/.agents/skills/` as a
   shared cross-runtime alias). So Gemini is *already* partly covered by `.agents/`,
   but has no project-level `.gemini/` mirror like the other hosts.

## Goals

- A single source of truth (`skills/usually/SKILL.md`) → all mirrors generated, never hand-copied.
- A check that fails (CI/test) when any on-disk mirror is stale.
- Gemini as a first-class project host with its own `.gemini/skills/usually/SKILL.md`.
- Leave `.gene/` untouched (it belongs to the external compiler, not a host).

## Design

### Source of truth

The true source is **`skills/usually/prompt.md`** (the skill body, no frontmatter) plus
**`skills/usually/skill.yaml`** (`name` / `description` / `when-to-use`). Everything else is a
generated artifact, including `skills/usually/SKILL.md` itself (which today is hand-kept = the
same body + a frontmatter and is its own latent drift pair with `prompt.md`). The frontmatter
`description` is the Forge rule: `"<yaml.description> <yaml.when-to-use>"` (joined by one space).

### Variation model

Each generated **target** = a frontmatter variant + the body with an install variant, joined as
`frontmatter + "\n" + body`. Only **two axes** vary:

1. **Frontmatter.**
   - `asis` — just `description:` (canonical `skills/usually/SKILL.md` and the Claude mirror).
   - `name` — `name: usually` then `description:` (OpenCode, Codex/`.agents`, Gemini).
   - `cursor` — `description:` then `alwaysApply: false` (Cursor).
2. **Install section** — the bullet block under "## The script", between the stable anchors
   `- In this repo: ...also works.` and `\nBelow, \`POCKET\` means`. Variants:
   - `claude` — keep the body's SessionStart-hook wording.
   - `manual` — the bootstrap / keep-it-fresh `cp` wording (the hook never runs on non-Claude hosts).

Everything else (flow, sub-actions, principles, the `seq` numbering paragraph) is **shared** and
copied verbatim from `prompt.md`, so any future edit to shared prose propagates to all 6 targets.

### `scripts/sync-mirrors.mjs`

- `readSource(root)` → `{ body, description }` from `prompt.md` + `skill.yaml`.
- `MANUAL_INSTALL` is the only non-derived prose — a single hardcoded constant in this file.
- `TARGETS` table maps each output path → `{ frontmatter, install }` variant (6 entries: the
  canonical `skills/usually/SKILL.md` plus the 5 host mirrors).
- `generate(source, target)` → the exact expected file text for one target (pure function).
- `syncAll({ repoRoot, check })` → writes every target (or, in check mode, reports stale).
- CLI:
  - `node scripts/sync-mirrors.mjs` → write every target, report which changed.
  - `node scripts/sync-mirrors.mjs --check` → exit 1 and list any stale target, write nothing.
- Mirrors `scripts/bump-version.mjs` conventions (ESM, `export` the pure fns, run-as-main guard).

### `scripts/sync-mirrors.test.mjs`

- **Unit**: `generate` yields the right frontmatter per variant; the install block is swapped to
  `manual` for non-Claude targets; the `claude`/`asis` target reproduces a fixture exactly.
- **Drift guard (the real protection)**: read the *actual* `prompt.md` + `skill.yaml` and each
  *actual* on-disk target, and assert `onDisk === generate(source, target)`. This fails the test
  suite the moment any target diverges from the source — same logic as `--check`.

### Gemini mirror

`.gemini/skills/usually/SKILL.md`, generated with the `name` + `manual` variants (identical
transform to `.agents`). Added to the `HOSTS` table so it is generated and drift-checked like
the rest. The `name: usually` frontmatter is exactly what Gemini CLI requires.

## Non-goals / left alone

- The runtime dropdown host list inside `pocket.mjs` (claude/opencode/codex) — Gemini has no
  native slash-dropdown target; this design only covers the **skill mirror**, not dropdown
  generation. Called out so we don't imply Gemini gets a generated `/usually:` dropdown.
- `.gene/` Forge metadata — untouched.
- No attempt to reinstate or invoke the external `gene`/Forge compiler.

## Workflow after this change

Edit `skills/usually/SKILL.md`, then `node scripts/sync-mirrors.mjs`. The test (`--check`
logic) guarantees you can't merge a stale mirror.
