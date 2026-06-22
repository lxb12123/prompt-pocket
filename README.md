# Prompt Pocket

Prompt Pocket — an agent plugin forged by Agent Path Forge.

> Forged by [Agent Path Forge](https://github.com/lxb12123/agent-path-forge) — a multi-host agent plugin you can install and own.

## Quick start

### Claude Code

```text
/plugin marketplace add lxb12123/prompt-pocket
/plugin install prompt-pocket@prompt-pocket-marketplace
```

Then use the slash commands below in any project.

### Codex (also Copilot / Gemini)

```bash
# Native skill install — Codex loads SKILL.md skills from its skills dir:
cp -r skills/* ~/.codex/skills/     # or cross-runtime (Codex + Copilot + Gemini): ~/.agents/skills/
```

Or project-scoped: append this plugin's `AGENTS.md` into your project-root `AGENTS.md`. Codex concatenates `AGENTS.md` from the repo root down — it's additive and never overrides your own.

### Cursor

This repo already ships `.cursor/rules/` — open the project in Cursor and the rules load automatically.

## Skills

- **/usually** — 提示词口袋——记住你最常用的提示词,用原生菜单上下键选中后直接代为执行;支持 add/delete/edit/find 子动作,并自动扫描会话把重复 ≥7 次的提示词收录。 _(use when: 当用户想列出/复用自己的高频提示词(说 /usually、"我平时常说啥"、"列一下常用的"),或要 add 记一句、delete 删一句、edit 改一句、find 查一句时使用。)_

## Layout

```
Prompt Pocket/
├── .claude-plugin/        # plugin.json + marketplace.json (installable)
├── skills/<name>/SKILL.md # skills (Claude reads these at the plugin root)
├── agents/                # bundled subagents
├── commands/<name>.md     # slash-command entry points
└── AGENTS.md              # open standard — Codex / Cursor / Copilot / Gemini
```
