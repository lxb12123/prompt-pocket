# Prompt Pocket

**Remember your most-used prompts, and pick one to run instantly — across every agent.**

You repeat the same prompts all the time ("pull the remote main and rebuild on the
simulators", "run the fixed build flow, don't touch the code", …). Prompt Pocket keeps
them in one place, automatically notices the ones you type again and again, and lets you
pick one from a menu to run it on the spot — no copy‑paste.

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
platform is a single reader function (see [Adding a platform](#adding-a-platform)). On
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
```

Invoke: type `/usually` (or "list my usual prompts"). Manual global skill: copy
`.claude/skills/usually/` into `~/.claude/skills/`.

### 2. Codex

```bash
# Codex loads SKILL.md skills from its skills dir (global, any project):
cp -r .agents/skills/usually ~/.codex/skills/usually
```

Invoke: say "list my usual prompts" (Codex has no slash UI). Project‑scoped alternative:
the repo's `AGENTS.md` is picked up automatically when you run Codex in the repo.

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
# Gemini reads AGENTS.md project context; or add the /usually command:
mkdir -p ~/.gemini/commands
```

Project‑scoped: run `gemini` in the repo — it reads `AGENTS.md` and learns the skill; ask
"list my usual prompts". (Gemini's custom commands use TOML in `~/.gemini/commands/`; the
AGENTS.md route needs no extra setup.)

### 7. Any other AGENTS.md / SKILL.md agent (Windsurf, Cline, Zed, Amp, …)

`SKILL.md` + `AGENTS.md` are a cross‑agent open standard. For hosts not listed above, drop
the skill into the shared location most of them read:

```bash
mkdir -p ~/.agents/skills && cp -r .agents/skills/usually ~/.agents/skills/usually
```

or, project‑scoped, just open the repo — the agent reads `AGENTS.md`. Pick‑to‑run and
manual `add/find/edit/delete` work everywhere; **auto‑scan** is the only host‑specific part
(see [Adding a platform](#adding-a-platform) to wire up a new agent's session format).

---

## Usage

| Command | What it does |
|---|---|
| `/usually` | Scan recent sessions, then show your high‑frequency prompts. Pick one (arrow keys in Claude Code, a number in Codex) and it runs immediately. |
| `/usually add <text>` | Manually save a prompt to the pocket. |
| `/usually find <keyword>` | Search the pocket. |
| `/usually edit <id> <new text>` | Change a saved prompt. |
| `/usually delete <id\|text>` | Remove a prompt. |

On hosts without slash commands, just describe the intent in natural language
("list my usual prompts", "save this prompt", …) — the skill maps it to the right action.

A prompt is auto‑recorded once you've typed it **7 or more times** across your sessions.
Manually added prompts always show, regardless of count.

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

## Adding a platform

The scanner reads "human‑typed input only" per agent and merges the counts. Each agent has
one small reader (`claudeTexts` / `codexTexts` / `opencodeTexts`) — jsonl or SQLite,
whatever the host uses. To support a new agent, add one reader to
`skills/usually/scripts/pocket.mjs` following the existing ones:

```js
function myAgentTexts() {
  return readJsonlTexts(join(HOME, '.myagent', 'sessions'), (ev) => {
    if (!isHumanTyped(ev)) return null;     // host-specific check
    return cleanCandidate(ev.text);
  });
}
```

then include it in `cmdScan`. Everything else (store, threshold, list, CRUD) is shared.
See [`skills/usually/reference/store-and-scan.md`](skills/usually/reference/store-and-scan.md)
for the per‑agent transcript formats.

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
├── .opencode/                   # OpenCode-native skill + /usually command
├── .agents/skills/usually/      # cross-agent SKILL.md (Copilot, Cursor, Windsurf, …)
├── AGENTS.md                    # open standard — Codex / Cursor / Copilot / Gemini / OpenCode
└── .cursor/rules/               # native Cursor rule
```

> The per‑host skill files (`.claude/`, `.opencode/`, `.agents/`) all mirror the single
> source of truth, `skills/usually/prompt.md`, and call the same `pocket.mjs`.

## License

[MIT](LICENSE) © lxb12123
