<div align="center">

<img src="assets/prompt-pocket-mascot.png" alt="Prompt Pocket mascot — a kangaroo with your prompts tucked in its pouch" width="440">

# Prompt Pocket

**English** · [中文](README.zh-CN.md)

**Stop re‑typing the same prompt. Tuck it in your pocket and run it with one tap — across every agent.**

</div>

### The pain

In real development there's always **that one prompt you keep needing** — the same
instruction, over and over. Then you open a **new session** and the agent has forgotten
everything, so you need it *again*. And every time, your only option is to **hand‑type the
whole thing**. It's a small annoyance that you pay a hundred times a day.

There's no "recent prompts," no history that survives a fresh session, no way to carry it
from one tool to the next. Just you, re‑typing.

### The fix

This is exactly what Prompt Pocket is for — **a kangaroo's pouch for your prompts**:

- **Save a prompt once.** `add` any line you keep needing (or let it auto‑record the ones
  you've already repeated 7+ times) — it's now in your pocket for good.
- **Run it fast.** Every saved prompt drops **straight into your agent's native `/`
  dropdown** — arrow to it, press Enter, it runs. No copy‑paste, no re‑typing.
- **In every session, in every tool.** One shared pocket at `~/.prompt-pocket/store.json`
  that **every agent reads** — save a prompt in Codex, fire it in Claude Code. A new session
  never forgets it.

Type `/usually` and your usual prompts are right there.

> Forged by [Agent Path Forge](https://github.com/lxb12123/agent-path-forge) — one source, compiled into a plugin every host can install.

---

## Multi‑platform support

Prompt Pocket is **not** a Claude‑ or Codex‑only tool. It ships as one gene skill that
compiles to each host's native format:

| Platform | How it loads | Pick‑to‑run & manual CRUD | Auto‑scan (≥7×) |
|---|---|---|---|
| **Claude Code** | `/plugin install` (or `.claude/skills/`) | ✅ native arrow‑key menu | ✅ scans `~/.claude/projects` |
| **Codex** | `~/.codex/skills/` or project `AGENTS.md` | ✅ numbered list | ✅ scans `~/.codex/sessions` |
| **OpenCode** | native `SKILL.md` (`.opencode/skills/`, `.claude/skills/`) + `AGENTS.md` | ✅ numbered list | ✅ scans `~/.local/share/opencode/opencode.db` |
| **Cursor** | `.cursor/rules/` + `AGENTS.md` (auto‑loads); SKILL.md skills (v2.4+) | ✅ | manual add (scan: add a reader) |
| **GitHub Copilot** | `SKILL.md` in `.agents/skills` / `~/.copilot/skills` + `AGENTS.md` | ✅ | manual add (scan: add a reader) |
| **Gemini CLI** | `AGENTS.md` / `GEMINI.md` context | ✅ | manual add (scan: add a reader) |
| **Any other** (Windsurf, Cline, Zed, Amp…) | `AGENTS.md` / `.agents/skills/` open standard | ✅ | manual add (scan: add a reader) |

**The whole experience — list, pick‑to‑run, and manual `add` / `delete` / `edit` /
`find` — works on every host.** The one host‑specific piece is the *automatic* recording
of prompts you've repeated 7+ times, which has to parse each agent's own session format.
Today that's wired up for **Claude Code**, **Codex** and **OpenCode**; adding another
platform is a single reader function (see [Adding a platform](CONTRIBUTING.md#adding-a-platform)). On
hosts without a scanner you simply use `add` to record prompts yourself.

The store lives at `~/.prompt-pocket/store.json` and is **shared by every agent** — record
a prompt in Codex, reuse it in Claude Code.

---

## Quick start

There are two ways to use it on any host:

- **Project‑scoped** — `git clone` this repo and open/run your agent inside it. Every host
  file (`AGENTS.md`, native `SKILL.md`, `.cursor/rules/`, …) is already present and the
  skill activates automatically. Nothing to install.
- **Global** — install the skill into your agent's home dir so it works in *any* project.

For global use, run this **once** so the deterministic core is reachable from anywhere
(every host below calls it by this absolute path):

```bash
git clone https://github.com/lxb12123/prompt-pocket && cd prompt-pocket
mkdir -p ~/.prompt-pocket && cp skills/usually/scripts/pocket.mjs ~/.prompt-pocket/pocket.mjs
```

Then pick your platform:

### 1. Claude Code

```text
/plugin marketplace add lxb12123/prompt-pocket
/plugin install prompt-pocket@prompt-pocket-marketplace
/reload-plugins
```

**Activate & first run:** `/reload-plugins` makes the plugin live in your current session
(no restart needed — a new session loads it automatically; Claude Code does **not** prompt
you). Then type **`/prompt-pocket:usually`** once.
A freshly‑installed plugin only exposes the namespaced command `/prompt-pocket:usually`
(Claude Code *always* prefixes plugin commands — see [Why `/usually` vs
`/prompt-pocket:usually`](#why-usually-vs-prompt-pocketusually)). That first run scans your
sessions and **bootstraps a bare, global `/usually`** at `~/.claude/commands/usually.md`.
From then on, just type **`/usually`** in any project. (Manual alternative: copy
`.claude/skills/usually/` into `~/.claude/skills/`.)

### 2. Codex

```bash
# Codex loads SKILL.md skills from its skills dir (global, any project):
cp -r .agents/skills/usually ~/.codex/skills/usually
```

After installing, open a new Codex thread. If `$usually` or `/skills` does not show it, restart Codex.

Invoke: type `$usually list my usual prompts` (or `/skills` → pick Usually) — it lists your prompts numbered; reply with a number to run one. Codex has no per‑prompt dropdown. Project‑scoped alternative:
the repo's `AGENTS.md` is picked up automatically when you run Codex in the repo.

Manage prompts the same way — natural language, no slash sub‑commands:
- Add: `$usually save this prompt: <text>`
- Find: `$usually find my prompt about <keyword>`
- Edit: `$usually change the <keyword> prompt to <new text>`
- Delete: `$usually delete the <keyword> prompt`

The pocket is shared, so anything you add in Codex also shows up in Claude's `/usually`.

### 3. OpenCode

```bash
# Native skill (OpenCode reads SKILL.md from its skills dir):
cp -r .opencode/skills/usually ~/.config/opencode/skills/usually
# Optional: the /usually slash command
mkdir -p ~/.config/opencode/commands && cp .opencode/commands/usually.md ~/.config/opencode/commands/usually.md
```

Invoke: type `/usually`, or just ask — OpenCode loads the skill on demand. (Project‑scoped:
`.opencode/`, `.claude/skills/` and `AGENTS.md` in the repo all work out of the box.)

### 4. Cursor

```bash
# Skill (Cursor reads SKILL.md skills, v2.4+):
cp -r .agents/skills/usually ~/.cursor/skills/usually   # or per-project: .cursor/ already shipped
```

Invoke: open the project — `.cursor/rules/usually.mdc` and `AGENTS.md` load automatically;
then ask "list my usual prompts". The agent runs the pocket script for you.

### 5. GitHub Copilot

```bash
# Personal skill (Copilot reads ~/.copilot/skills or ~/.agents/skills; SKILL.md needs a name: field — included):
mkdir -p ~/.copilot/skills && cp -r .agents/skills/usually ~/.copilot/skills/usually
```

Invoke: in agent mode, ask "list my usual prompts". Project‑scoped: this repo ships
`.agents/skills/usually/SKILL.md`, which Copilot also reads from a repo's `.agents/skills/`.

### 6. Gemini CLI

```bash
# Native skill (Gemini reads SKILL.md from ~/.gemini/skills or the shared ~/.agents/skills):
mkdir -p ~/.gemini/skills && cp -r .gemini/skills/usually ~/.gemini/skills/usually
```

Project‑scoped: run `gemini` in the repo — it reads `.gemini/skills/usually/SKILL.md` (and
`AGENTS.md` context) and learns the skill; ask "list my usual prompts". User‑level skills live
in `~/.gemini/skills/`, with `~/.agents/skills/` as a shared cross‑runtime alias (so the Codex
copy doubles as Gemini's). Gemini's custom commands use TOML in `~/.gemini/commands/`.

### 7. Any other AGENTS.md / SKILL.md agent (Windsurf, Cline, Zed, Amp, …)

`SKILL.md` + `AGENTS.md` are a cross‑agent open standard. For hosts not listed above, drop
the skill into the shared location most of them read:

```bash
mkdir -p ~/.agents/skills && cp -r .agents/skills/usually ~/.agents/skills/usually
```

or, project‑scoped, just open the repo — the agent reads `AGENTS.md`. Pick‑to‑run and
manual `add/find/edit/delete` work everywhere; **auto‑scan** is the only host‑specific part
(see [Adding a platform](CONTRIBUTING.md#adding-a-platform) to wire up a new agent's session format).

---

## Usage

| Command | What it does |
|---|---|
| `/usually` | Re‑scan recent sessions (pulls in newly‑frequent prompts & refreshes the `/usually:` dropdown), then **list** your high‑frequency prompts (each with its `id`). Pick one and it runs immediately. |
| `/usually add <text>` | Manually save a prompt to the pocket. |
| `/usually find <keyword>` | Search the pocket. |
| `/usually edit <id> <new text>` | Change a saved prompt. Needs the prompt's **`id`** — see below. |
| `/usually delete <id\|text>` | Remove a prompt by `id` or exact text. |

On hosts without slash commands, just describe the intent in natural language
("list my usual prompts", "save this prompt", …) — the skill maps it to the right action.

A prompt is auto‑recorded once you've typed it **7 or more times** across your sessions.
Manually added prompts always show, regardless of count.

### Two ways to see your saved prompts

The `/` dropdown shows **command names only** — it does **not** preview your prompts inline,
so typing `/usually` + a space shows nothing extra. To actually see them:

1. **Quick‑run** — type **`/usually:`** (with the colon). The dropdown fills with one
   entry per saved prompt (`/usually:<slug>`); arrow to one and press Enter to run it.
   This is the fast daily path, but it's a **snapshot** — it shows the prompts as of the
   last refresh, and picking one does **not** re‑scan.
2. **Refresh & list** — run **`/usually`** (just press Enter, no args). This **re‑scans your
   recent sessions first**, so any prompt you've newly repeated 7+ times gets picked up and
   added to the `/usually:` dropdown — then it lists everything for you to pick from.

> **`/usually:` runs what you already have; `/usually` is what pulls in your latest
> most‑used prompts.** The quick‑run dropdown only refreshes on `/usually`, `add`, `edit`,
> or `delete`, so run a bare `/usually` now and then to keep it current.
>
> Note: `add` / `edit` / `delete` only rewrite the dropdown **files on disk**. The
> **session you're currently in** loaded its command list at startup and won't rescan the
> command dir mid‑session — so a prompt you just added won't show up in *this* session's
> `/usually:` dropdown until you run `/reload-plugins` (or open a new session). The data is
> saved either way; only the live dropdown is stale.

### Finding a prompt's `id` (for `edit` / `delete`)

Every saved prompt has a short 8‑char `id`, used by `edit` / `delete`. Get it from the
script's `list` output, which always prints it:

```bash
node ~/.prompt-pocket/pocket.mjs list
# id        count  prompt
# a1b2c3d4   16    Pull the latest main branch and rebuild the project…
# e5f6a7b8   13    Run the build pipeline and deploy to staging…
```

Then edit/delete by that id (a unique **id‑prefix** also works, e.g. `a1b2`):

```text
/usually edit a1b2c3d4 Pull main and rebuild from scratch
/usually delete a1b2c3d4
```

`edit` matches by **full id**, **id‑prefix (if unique)**, or **exact original text** — a
partial keyword will *not* match, which is why you normally pass the id. (`delete` also
accepts the exact text.)

### Native slash dropdown

Every change regenerates one lightweight command per saved prompt, so your prompts show up
**directly in the host's native `/` dropdown** — arrow to one and press Enter to run it, no
round‑trip:

| Host | Type this | You get |
|---|---|---|
| Claude Code | `/usually` | `/usually:<slug>` entries (slug = a readable fragment of the prompt); arrow‑pick one to run it |
| OpenCode | `/usually` | same `/usually:<slug>` entries |

On **Codex** there is no slash dropdown — say **"list my usual prompts"** and reply with a number.

The slug is a readable fragment of the prompt (letters/CJK/digits, ~16 chars, never cut
mid‑ASCII‑word). The full prompt is deliberately **kept out of each entry's description** —
descriptions are preloaded into every session, so they're generic; the full text lives in
the command body and runs when you pick the entry. Generated files are written to
`~/.claude/commands/usually/`, `~/.config/opencode/commands/usually/`, and
`~/.codex/prompts/usually-*.md`. Only files carrying the `<!-- prompt-pocket:generated -->`
marker are ever deleted, and Codex's shared prompts dir is additionally gated by the
`usually-` prefix — your own prompts are never touched. Run `pocket.mjs sync` to rebuild the
dropdown manually after editing the store by hand.

### Why `/usually` vs `/prompt-pocket:usually`

This trips people up, so here is exactly what's going on.

**A plugin can never give you a bare `/usually`.** Claude Code *always* namespaces a
plugin's commands as `/<plugin-name>:<command>`, so the plugin can only ever surface
`/prompt-pocket:usually`. The prefix is **mandatory by design** (it prevents collisions
between plugins) — no frontmatter field, no `plugin.json` setting, and no alias can remove
it ([claude-code#15882](https://github.com/anthropics/claude-code/issues/15882)). On top of
that, plugin commands currently **don't render their `argument-hint`** grey hint at all,
even though the field is in the file — a known bug
([claude-code#46626](https://github.com/anthropics/claude-code/issues/46626)). So
`/prompt-pocket:usually` is long *and* shows no hint, and neither can be fixed from inside
the plugin.

**The only way to get a bare, global `/usually` (with a working hint) is a user‑level
command file** at `~/.claude/commands/usually.md` — a personal/project command, not a
plugin one, takes a different (non‑buggy) code path and renders the hint. A plugin can't
write that file at install time… **but the script it ships can, at runtime.** So on the
first `/prompt-pocket:usually` (or any `scan`/`add`/`edit`/`delete`), `sync` bootstraps
`~/.claude/commands/usually.md` (and the OpenCode equivalent) for you. After that:

| Command | Source | Scope | Hint | Role |
|---|---|---|---|---|
| `/usually` | user‑level file `sync` writes | every project | ✅ shows | **daily entry** — list + manage |
| `/usually:<slug>` | generated per‑prompt files | every project | n/a | **run a saved prompt instantly** |
| `/prompt-pocket:usually` | the installed plugin | every project | ❌ (bug) | first‑run bootstrap / fallback |

The bootstrap is **idempotent and marker‑gated**: it creates `usually.md` only if it's
absent or already carries our `<!-- prompt-pocket:generated -->` marker, so it will **never
overwrite a `usually.md` you wrote yourself**. (On Codex, say **"list my usual prompts"** and reply with a number.)

### Under the hood (0‑token core)

All state — the store, frequency counting, and transcript scanning — is handled by a
single deterministic Node script, so the model never has to "remember" your data:

```bash
node skills/usually/scripts/pocket.mjs list      # show the pocket
node skills/usually/scripts/pocket.mjs scan      # scan Claude + Codex + OpenCode sessions, record ≥7× prompts
node skills/usually/scripts/pocket.mjs add  "<text>"
node skills/usually/scripts/pocket.mjs find "<keyword>"
```

---

## Updating

The repo is the single source of truth. How you pull a new version depends **only on how you
installed** — pick your row.

### Claude Code (installed as a plugin)

```text
/plugin marketplace update prompt-pocket-marketplace   # re-pulls from GitHub, updates the plugin
/reload-plugins                                         # activate the new version in this session
```

Equivalent in the `/plugin` menu: **Marketplaces → prompt-pocket-marketplace → Update
marketplace** (then `/reload-plugins`). To never do this by hand again, pick **Enable
auto-update** there — it refreshes on session start.

You don't touch the runtime core: on the next session start the plugin's `SessionStart` hook
(`hooks/sync-runtime.mjs`) re‑syncs `~/.prompt-pocket/pocket.mjs` from the freshly installed
plugin and regenerates the `/usually:` dropdown. Your store (`~/.prompt-pocket/store.json`) is
never touched. (The same hook bootstraps that file on first install, too.)

### Every other host (Codex / OpenCode / Cursor / Gemini / Copilot)

These aren't plugins — they read the skill straight from disk, so updating = pulling the repo
and refreshing whatever you installed.

**Project‑scoped** (you `git clone`d and run the agent *inside* the repo) — one command, done:

```bash
git -C /path/to/prompt-pocket pull          # host reads the in-repo mirror + pocket.mjs directly
```

**Global** (you copied the skill into your agent's home dir at install) — pull, refresh the
shared runtime core, re‑copy the **same** skill dir you used at install, rebuild the dropdown:

```bash
git -C /path/to/prompt-pocket pull
cp /path/to/prompt-pocket/skills/usually/scripts/pocket.mjs ~/.prompt-pocket/pocket.mjs   # runtime core (shared by all hosts)
cp -r /path/to/prompt-pocket/.agents/skills/usually ~/.codex/skills/usually              # ← swap for YOUR host's dir (see Quick start)
node ~/.prompt-pocket/pocket.mjs sync                                                     # rebuild the /usually dropdown
```

> `~/.prompt-pocket/pocket.mjs` is shared by every host. If you also run Claude Code here, its
> `SessionStart` hook keeps that file current for free — the other hosts then pick up the new
> logic with no `cp`; only the per‑host **skill text** still needs a re‑copy (or a `git pull`
> if project‑scoped).

---

## Uninstalling

Prompt Pocket keeps everything local and leaves a small, predictable footprint — removing it is
just deleting those files. Nothing was ever sent over the network, so there's nothing else to revoke.

### Claude Code (installed as a plugin)

```text
/plugin uninstall prompt-pocket@prompt-pocket-marketplace
```

That also removes the bundled `SessionStart` hook. Then delete the generated slash‑command files
and (optionally) the local store:

```bash
rm -rf ~/.claude/commands/usually ~/.claude/commands/usually.md   # generated /usually dropdown + manager command
rm -rf ~/.prompt-pocket                                           # runtime core + your saved prompts (store.json)
```

> Keep `~/.prompt-pocket/store.json` if you might reinstall later — it's your saved prompts. Only
> the marker‑gated generated files are yours to delete here; nothing else is touched.

### Every other host (Codex / OpenCode / Cursor / Gemini / Copilot)

Remove the skill dir you copied at install (see [Quick start](#quick-start) for the exact path per
host — e.g. `~/.codex/skills/usually`, `~/.gemini/skills/usually`, or the shared
`~/.agents/skills/usually`), then the generated dropdown files and the shared runtime:

```bash
rm -rf ~/.config/opencode/commands/usually      # OpenCode dropdown
rm -f  ~/.codex/prompts/usually-*.md            # Codex dropdown (usually- prefix only — your own prompts are safe)
rm -rf ~/.prompt-pocket                          # runtime core + store.json (drop this line to keep your prompts)
```

---

## Layout

```
prompt-pocket/
├── .claude-plugin/              # plugin.json + marketplace.json (installable)
├── skills/usually/
│   ├── skill.yaml               # name, description, when-to-use, capabilities
│   ├── prompt.md                # the skill's instructions (single source of truth)
│   ├── scripts/pocket.mjs       # deterministic core: store + CRUD + cross-agent scan
│   └── reference/               # store & scan rules, read on demand
├── commands/usually.md          # Claude / generic slash-command entry point
├── scripts/                     # bump-version.mjs (release) + sync-mirrors.mjs (skill compiler)
├── .opencode/                   # OpenCode-native skill + /usually command
├── .agents/skills/usually/      # cross-agent SKILL.md (Codex, Copilot, Gemini, Windsurf, …)
├── .gemini/skills/usually/      # Gemini-native skill mirror
├── AGENTS.md                    # open standard — Codex / Cursor / Copilot / Gemini / OpenCode
└── .cursor/rules/               # native Cursor rule
```

> `skills/usually/prompt.md` (body) + `skills/usually/skill.yaml` (metadata) are the single
> source of truth. The canonical `skills/usually/SKILL.md` and every per‑host mirror
> (`.claude/`, `.opencode/`, `.agents/`, `.gemini/`, `.cursor/`) are **generated** from it by
> `scripts/sync-mirrors.mjs` — never hand‑edited — and all call the same `pocket.mjs`.

## Contributing

Cutting a release, adding a host platform, or editing the skill text? See
[CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE) © lxb12123
