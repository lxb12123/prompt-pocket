---
description: 提示词口袋——记住你最常用的提示词,用原生菜单上下键选中后直接代为执行;支持 add/delete/edit/find 子动作,并自动扫描会话把重复 ≥7 次的提示词收录。 当用户想列出/复用自己的高频提示词(说 /usually、"我平时常说啥"、"列一下常用的"),或要 add 记一句、delete 删一句、edit 改一句、find 查一句时使用。
---

# /usually — 提示词口袋

记住你最常用的提示词,一处管理、选中即用。所有数据与频次统计都由确定性脚本完成
(0 token);你只负责:判断子动作 → 调脚本 → 用原生菜单让用户选 → 选中即执行。

**核心脚本(全部输出单个 JSON,直接复述给用户即可):**
`node skills/usually/scripts/pocket.mjs <command>`,在项目根目录运行。
存储在 `~/.prompt-pocket/store.json`(用户级、**跨 agent 共享**:Claude / Codex 等读同一份)。
scan 会同时扫 Claude(`~/.claude/projects`)和 Codex(`~/.codex/sessions`)两边的会话记录。

---

## 先判断用户要哪个子动作

根据用户这次的话(可能是 `/usually`、`/usually add ...`,或自然语言)选一条:

| 用户意图 | 子动作 |
|---|---|
| 只说 `/usually`、"列一下我常用的"、"我平时常说啥" | **列出 + 选中执行**(主流程,见下) |
| "记下这句""add 这条""以后我还要用…" | **add** |
| "删掉那条""不要…了""delete" | **delete** |
| "改一下那条""把…换成…""edit" | **edit** |
| "有没有…那句""查一下""find""我之前是不是说过…" | **find** |

---

## 主流程:列出 + 选中即执行

1. **先刷新频次**(扫描会话记录,把重复 ≥7 次的提示词自动收录):
   ```
   node skills/usually/scripts/pocket.mjs scan
   ```
   简短告诉用户本次新收录了几条(`addedCount`)。

2. **取列表**:
   ```
   node skills/usually/scripts/pocket.mjs list
   ```
   用返回的 `high` 数组(高频 + 手动收录的提示词)。若 `high` 为空,告诉用户口袋还
   是空的,建议先 `/usually add <一句话>` 或多用几次再回来。

3. **让用户选**(尽量用宿主的原生选择菜单,体验最好):
   - **若宿主有原生选择 UI**(如 Claude Code 的 AskUserQuestion 工具):把 `high` 里
     每条提示词作为一个选项(label 用原文,过长就截断并在 description 写全文 + `12x`
     这样的频次)。这就是"像 Claude 那样上下键选、回车选中"。
   - **若宿主没有原生选择 UI**(如 Codex 等):**编号列出** `high`(`1) 16x 原文…`),
     让用户回一个编号即可。
   无论哪种,选中的结果都进入第 4 步。

4. **选中即执行**:用户选定某条后,**把那条提示词的原文当作用户对你下达的新指令,
   直接开始执行**,就像用户亲手把它打进了输入框。不要只复述、不要再问"要我做吗"——
   选中即代表确认。(技能无法把文字写回 CLI 输入框,所以"选完就用"= 直接代为执行。)

---

## 子动作

**add** — 记下一句用户主动给的提示词:
```
node skills/usually/scripts/pocket.mjs add "<提示词原文>"
```
原文从用户这次的话里提取(去掉"记一下""add"之类的引导词)。已存在则标记为 manual。
回报新增/已存在。

**delete** — 删除一条。先确认删哪条:
- 用户给了原文/关键词 → 先 `find` 定位,拿到 `id`,确认无歧义后再删。
- 然后:`node skills/usually/scripts/pocket.mjs delete "<id 或原文>"`
回报删除的那条;`not found` 时告诉用户没匹配到。

**edit** — 修改一条的文字:
1. 先 `find` 拿到要改那条的 `id`。
2. `node skills/usually/scripts/pocket.mjs edit <id> "<新的提示词>"`
回报 `before` / `after`。(注意:edit 后 `id` 会随新文字改变。)

**find** — 查询口袋里有没有某句:
```
node skills/usually/scripts/pocket.mjs find "<关键词>"
```
把 `matches`(已按频次排序)列给用户;`count: 0` 就明说没有这条。

---

## 原则
- 脚本是唯一真相源:增删改查与频次都走脚本,你不要自己"记"数据。
- 删除/修改前若有歧义(匹配到多条),先列出来让用户确认再动手。
- 选中即执行是这个技能的灵魂:列表选完别停在复述,直接干活。
