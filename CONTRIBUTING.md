# Contributing & maintaining

Notes for maintainers and contributors. End-user docs live in the
[README](README.md) ([中文](README.zh-CN.md)); this file covers cutting a
release, editing the skill, and adding a new host platform.

## Releasing (maintainers)

Users only get a new version when the plugin's **version changes** — `/plugin update` is a
silent no‑op otherwise, and the version must change in **both** `.claude-plugin/plugin.json`
and `.claude-plugin/marketplace.json`. So every release is three steps from repo root:

```bash
node scripts/bump-version.mjs patch     # or: minor | major | 0.4.2  (updates both manifests)
git commit -am "…" && git push          # open a PR
# merge to main
```

That's it — users pick it up with a single `/plugin update`, and their next session's
`SessionStart` hook re‑syncs the runtime core automatically (see
[Updating](README.md#updating)).

**Editing the skill text.** The skill is authored once in `skills/usually/prompt.md` (body)
+ `skills/usually/skill.yaml` (metadata). Every other copy — the canonical
`skills/usually/SKILL.md` and each host mirror (`.claude/`, `.opencode/`, `.agents/`,
`.gemini/`, `.cursor/`) — is **generated**. After editing the source, run:

```bash
node scripts/sync-mirrors.mjs            # regenerate all 6 targets from the source pair
node scripts/sync-mirrors.mjs --check    # CI/pre-commit guard: exit 1 if any target is stale
```

`sync-mirrors.test.mjs` runs the same `--check` logic, so a stale mirror fails the test suite.

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
