---
description: 提示词口袋——列出高频提示词并选中即执行;add/delete/edit/find 管理你常用的一句话
argument-hint: "[add|delete|edit|find] <文本>(留空=列出并选中执行)"
---

按 `skills/usually/prompt.md` 里的流程处理本次请求(它是这个技能的唯一真相源:
判断子动作 → 调用 `node skills/usually/scripts/pocket.mjs <command>` → 用原生菜单
让用户上下键选中 → **选中即直接代为执行**那条提示词)。

用户这次的输入(可能为空 = 走"列出 + 选中执行"主流程):

$ARGUMENTS
