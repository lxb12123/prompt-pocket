---
description: Prompt Pocket — list your high-frequency prompts and pick one to run; manage your go-to prompts with add/delete/edit/find
argument-hint: "[add|delete|edit|find] <text>  (empty = list and pick one to run)"
---

Handle this request by following the flow in `skills/usually/prompt.md` (the single source
of truth for this skill: decide the sub-action → run
`node skills/usually/scripts/pocket.mjs <command>` → let the user pick from a menu →
**run the picked prompt on their behalf**).

The user's input this turn (may be empty = run the "list + pick to run" main flow):

$ARGUMENTS
