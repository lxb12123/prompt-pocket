---
description: Prompt Pocket — list your high-frequency prompts and pick one to run; manage them with add/delete/edit/find
---

Handle this request by following the flow in `skills/usually/prompt.md` (the single source
of truth for this skill: decide the sub-action → run
`node skills/usually/scripts/pocket.mjs <command>` → let the user pick from a numbered list
→ run the picked prompt on their behalf). For the `usually` skill you can also load it
directly via the native skill tool.

The user's input this turn (may be empty = run the "list + pick to run" main flow):

$ARGUMENTS
