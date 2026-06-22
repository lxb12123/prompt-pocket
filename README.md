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
| **Cursor** | `.cursor/rules/` (auto‑loads) | ✅ | manual add (scan: add a reader) |
| **GitHub Copilot** | `AGENTS.md` / `~/.agents/skills/` | ✅ | manual add (scan: add a reader) |
| **Gemini CLI** | `AGENTS.md` / `~/.agents/skills/` | ✅ | manual add (scan: add a reader) |

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

### Claude Code

```text
/plugin marketplace add lxb12123/prompt-pocket
/plugin install prompt-pocket@prompt-pocket-marketplace
```

Then type `/usually` in any project.

### Codex (also Copilot / Gemini)

```bash
# Native skill install — Codex loads SKILL.md skills from its skills dir:
cp -r skills/* ~/.codex/skills/     # cross-runtime (Codex + Copilot + Gemini): ~/.agents/skills/
```

Or project‑scoped: append this plugin's `AGENTS.md` into your project‑root `AGENTS.md`.
Hosts concatenate `AGENTS.md` from the repo root down — it's additive and never overrides
your own. Then just say "list my usual prompts".

### OpenCode

OpenCode natively loads `SKILL.md` skills and reads `AGENTS.md`. This repo ships both, so
project‑scoped it works out of the box (open the repo and say "list my usual prompts" or
type `/usually`). For any project, install globally:

```bash
# Native skill (OpenCode reads SKILL.md from its skills dir):
cp -r .opencode/skills/* ~/.config/opencode/skills/
# Optional: the /usually slash command
cp -r .opencode/commands/* ~/.config/opencode/commands/
```

### Cursor

This repo already ships `.cursor/rules/` — open the project in Cursor and the rule loads
automatically.

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
├── AGENTS.md                    # open standard — Codex / Cursor / Copilot / Gemini / OpenCode
└── .cursor/rules/               # native Cursor rule
```

## License

[MIT](LICENSE) © lxb12123
