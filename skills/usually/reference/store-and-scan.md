# Prompt Pocket — 存储与扫描规则(按需查阅)

## 存储位置
`~/.prompt-pocket/store.json`——**host-neutral,跨 agent 共享**:Claude / Codex 等都读写
同一份口袋。首次运行若发现旧路径 `~/.claude/prompt-pocket/store.json`,会自动迁移过来。

## 数据结构
```json
{
  "version": 1,
  "prompts": [
    {
      "id": "a1b2c3d4",          // 由文本规范化后 sha1 取前 8 位;文字变 → id 变
      "text": "提示词原文",
      "count": 16,               // 出现次数(跨所有 agent 的真实累计频次)
      "source": "auto",          // auto=扫描自动收录 / manual=用户 /add
      "createdAt": "ISO 时间",
      "updatedAt": "ISO 时间"
    }
  ]
}
```

## 频次扫描(scan)——跨 agent
对每个存在的 agent 各用一套"只取人类输入"的规则,统计完合并计数:

| Agent | 会话目录 | 取哪种事件 | 取哪段文字 |
|---|---|---|---|
| Claude Code | `~/.claude/projects/**/*.jsonl` | `type:"user"` 且 `promptSource:"typed"` | `message.content`(string 或 text 块) |
| Codex CLI | `~/.codex/sessions/**/*.jsonl` | `type:"event_msg"` 且 `payload.type:"user_message"` | `payload.message` |

- 两边都过同一套 `cleanCandidate`:折叠空白、剥掉粘贴的提示符字形(`❯ ` / `› ` / `> `)、
  跳过长度 < 3、以 `/`(slash 命令)或 `#`(Codex 注入的 "# Files mentioned…")开头的、
  以及含 `<command…>` / `<system-reminder>` / `Caveat:` / `[Request interrupted` 的噪声。
- 统计 key = 小写规范化文本(大小写不敏感)。
- **阈值 = 7**:同一规范化文本在所有 agent 合计出现 ≥7 次,自动以 `source:"auto"` 收录。

> 说明:Claude 的 jsonl 有 `promptSource` 能精准识别"真人手敲";Codex 的 schema 没有等价
> 字段,只能靠 `cleanCandidate` 过滤注入内容,噪声容忍度略高,但阈值 7 足以滤掉偶发噪声。
> 新增别的 agent,只要照上表加一个 `xxxTexts()` 读取函数即可,其余逻辑不动。

## 列表(list)口径
- `all`:全部提示词,按 `count` 降序。
- `high`(进入"口袋"展示的集合)= `count >= 7` **或** `source == "manual"`。
  即:扫描出来的高频项 + 用户主动 `/add` 的项(手动项即便次数少也展示)。

## 阈值要改?
改 `scripts/pocket.mjs` 顶部的 `const THRESHOLD = 7;` 一处即可,list 与 scan 同步生效。
