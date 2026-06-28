<div align="center">

<img src="assets/prompt-pocket-mascot.png" alt="Prompt Pocket 吉祥物 —— 一只把你的提示词装进口袋的袋鼠" width="440">

# Prompt Pocket

[English](README.md) · **中文**

**别再重复敲同一句提示词。把它塞进口袋，一键就能跑 —— 在每一个 agent 里都行。**

</div>

### 痛点

真实开发里，总有**那么一句你反复要用的提示词** —— 同样的指令，敲了一遍又一遍。然后你开了个**新会话**，agent 把一切忘得精光，于是你又得*再敲一次*。每一次，你唯一的选择就是**整句从头手敲**。这是个一天要付出上百次的小烦恼。

没有"最近用过的提示词"，没有能熬过新会话的历史记录，也没法把它从一个工具带到下一个。只有你，一遍遍重敲。

### 解法

这正是 Prompt Pocket 要做的事 —— **给你的提示词配一个袋鼠口袋**：

- **一次保存，永久收好。** 用 `add` 把任何你常用的句子存下来（或者让它自动记录那些你已经重复用过 7 次以上的）—— 从此它就稳稳躺在你的口袋里。
- **飞快地跑起来。** 每一条保存的提示词都会**直接出现在 agent 原生的 `/` 下拉菜单里** —— 方向键选中、回车，它就跑起来。不用复制粘贴，不用重敲。
- **每个会话、每个工具里都在。** 一个共享口袋放在 `~/.prompt-pocket/store.json`，**每个 agent 都读它** —— 在 Codex 里存的提示词，在 Claude Code 里就能跑。新会话再也不会忘。

敲一句 `/usually`，你的常用提示词就在眼前。

> 由 [Agent Path Forge](https://github.com/lxb12123/agent-path-forge) 锻造 —— 一份源码，编译成每个 host 都能安装的插件。

---

## 多平台支持

Prompt Pocket **不是**只为 Claude 或 Codex 准备的工具。它以一份"基因 skill"的形式发布，编译成每个 host 的原生格式：

| 平台 | 如何加载 | 选取即跑 & 手动增删改查 | 自动扫描（≥7 次） |
|---|---|---|---|
| **Claude Code** | `/plugin install`（或 `.claude/skills/`） | ✅ 原生方向键菜单 | ✅ 扫描 `~/.claude/projects` |
| **Codex** | `~/.codex/skills/` 或项目 `AGENTS.md` | ✅ 编号列表 | ✅ 扫描 `~/.codex/sessions` |
| **OpenCode** | 原生 `SKILL.md`（`.opencode/skills/`、`.claude/skills/`）+ `AGENTS.md` | ✅ 编号列表 | ✅ 扫描 `~/.local/share/opencode/opencode.db` |
| **Cursor** | `.cursor/rules/` + `AGENTS.md`（自动加载）；SKILL.md skills（v2.4+） | ✅ | 手动 add（扫描：加一个 reader） |
| **GitHub Copilot** | `SKILL.md` 放在 `.agents/skills` / `~/.copilot/skills` + `AGENTS.md` | ✅ | 手动 add（扫描：加一个 reader） |
| **Gemini CLI** | `AGENTS.md` / `GEMINI.md` 上下文 | ✅ | 手动 add（扫描：加一个 reader） |
| **其他任意**（Windsurf、Cline、Zed、Amp…） | `AGENTS.md` / `.agents/skills/` 开放标准 | ✅ | 手动 add（扫描：加一个 reader） |

**整套体验 —— 列出、选取即跑，以及手动 `add` / `delete` / `edit` / `find` —— 在每一个 host 上都能用。** 唯一依赖 host 的部分，是*自动*记录那些你重复用过 7 次以上的提示词，因为它必须解析每个 agent 各自的会话格式。目前已经接好了 **Claude Code**、**Codex** 和 **OpenCode**；再加一个平台只是一个 reader 函数的事（见[新增平台](CONTRIBUTING.md#adding-a-platform)）。在没有扫描器的 host 上，你就用 `add` 自己记录提示词。

口袋存放在 `~/.prompt-pocket/store.json`，**被每个 agent 共享** —— 在 Codex 里记下一条，在 Claude Code 里复用它。

---

## 快速开始

任何 host 上都有两种用法：

- **项目级（Project‑scoped）** —— `git clone` 这个仓库，然后在仓库里打开/运行你的 agent。每个 host 的文件（`AGENTS.md`、原生 `SKILL.md`、`.cursor/rules/`…）都已就位，skill 会自动激活。无需安装。
- **全局（Global）** —— 把 skill 安装到 agent 的 home 目录，这样它在*任意*项目里都能用。

如果要全局使用，先**执行一次**这条命令，让确定性核心从任何地方都能被找到（下面每个 host 都用这个绝对路径调用它）：

```bash
git clone https://github.com/lxb12123/prompt-pocket && cd prompt-pocket
mkdir -p ~/.prompt-pocket && cp skills/usually/scripts/pocket.mjs ~/.prompt-pocket/pocket.mjs
```

然后挑你的平台：

### 1. Claude Code

[![Claude Code 演示 —— 在 /usually: 下拉里选一条直接跑](docs/img/demo-claude-poster.jpg)](https://github.com/lxb12123/prompt-pocket/raw/main/docs/img/demo-claude.mp4)

*▶ 点图播放 —— 装一次 → 在 `/usually:` 下拉里选一条 → 直接跑。*

```text
/plugin marketplace add lxb12123/prompt-pocket
/plugin install prompt-pocket@prompt-pocket-marketplace
/reload-plugins
```

**激活并首次运行：** `/reload-plugins` 让插件在当前会话立即生效（**不用重启**——新会话会自动加载；Claude Code **不会**提示你重启）。然后敲一次 **`/prompt-pocket:usually`**。刚装好的插件只暴露带命名空间的命令 `/prompt-pocket:usually`（Claude Code *总会*给插件命令加前缀 —— 见[为什么是 `/usually` 而不是 `/prompt-pocket:usually`](#为什么是-usually-而不是-prompt-pocketusually)）。那次首跑会扫描你的会话，并**引导生成一个裸的、全局的 `/usually`**，写在 `~/.claude/commands/usually.md`。从此以后，在任何项目里直接敲 **`/usually`** 即可。（手动方案：把 `.claude/skills/usually/` 复制到 `~/.claude/skills/`。）

### 2. Codex

```bash
# Codex 从它的 skills 目录加载 SKILL.md skills（全局，任意项目）：
cp -r .agents/skills/usually ~/.codex/skills/usually
```

安装后新开一个 Codex 会话；如果 `$usually` 或 `/skills` 里还看不到，就重启 Codex。

调用方式：打 `$usually 列出我的常用提示词`（或 `/skills` 选 Usually）—— 它会带编号列出，回数字执行一条。Codex 没有逐条 prompt 的下拉。项目级替代方案：在仓库里运行 Codex 时，仓库的 `AGENTS.md` 会被自动读取。

增删改查同理 —— 自然语言，没有斜杠子命令：
- 增：`$usually 记住这条 prompt：<文本>`
- 查：`$usually 有没有存过关于 <关键词> 的`
- 改：`$usually 把关于 <关键词> 的那条改成 <新文本>`
- 删：`$usually 删掉关于 <关键词> 的那条`

口袋是共享的，所以你在 Codex 加的，Claude 的 `/usually` 也立刻能看到。

### 3. OpenCode

```bash
# 原生 skill（OpenCode 从它的 skills 目录读取 SKILL.md）：
cp -r .opencode/skills/usually ~/.config/opencode/skills/usually
# 可选：/usually 斜杠命令
mkdir -p ~/.config/opencode/commands && cp .opencode/commands/usually.md ~/.config/opencode/commands/usually.md
```

调用方式：敲 `/usually`，或者直接问 —— OpenCode 会按需加载 skill。（项目级：仓库里的 `.opencode/`、`.claude/skills/` 和 `AGENTS.md` 都开箱即用。）

### 4. Cursor

```bash
# Skill（Cursor 读取 SKILL.md skills，v2.4+）：
cp -r .agents/skills/usually ~/.cursor/skills/usually   # 或按项目：.cursor/ 已随仓库发布
```

调用方式：打开项目 —— `.cursor/rules/usually.mdc` 和 `AGENTS.md` 会自动加载；然后问"列出我的常用提示词"。agent 会替你运行 pocket 脚本。

### 5. GitHub Copilot

```bash
# 个人 skill（Copilot 读取 ~/.copilot/skills 或 ~/.agents/skills；SKILL.md 需要 name: 字段 —— 已包含）：
mkdir -p ~/.copilot/skills && cp -r .agents/skills/usually ~/.copilot/skills/usually
```

调用方式：在 agent 模式下问"列出我的常用提示词"。项目级：本仓库自带 `.agents/skills/usually/SKILL.md`，Copilot 也会从仓库的 `.agents/skills/` 里读取它。

### 6. Gemini CLI

```bash
# 原生 skill（Gemini 从 ~/.gemini/skills 或共享的 ~/.agents/skills 读取 SKILL.md）：
mkdir -p ~/.gemini/skills && cp -r .gemini/skills/usually ~/.gemini/skills/usually
```

项目级：在仓库里运行 `gemini` —— 它会读取 `.gemini/skills/usually/SKILL.md`（以及 `AGENTS.md` 上下文）并学会这个 skill；问"列出我的常用提示词"即可。用户级 skill 放在 `~/.gemini/skills/`，并以 `~/.agents/skills/` 作为跨运行时共享别名（所以 Codex 那份副本同时也是 Gemini 的）。Gemini 的自定义命令用 `~/.gemini/commands/` 里的 TOML。

### 7. 其他任意 AGENTS.md / SKILL.md agent（Windsurf、Cline、Zed、Amp…）

`SKILL.md` + `AGENTS.md` 是一套跨 agent 的开放标准。对于上面没列到的 host，把 skill 丢进它们大多会读取的共享位置：

```bash
mkdir -p ~/.agents/skills && cp -r .agents/skills/usually ~/.agents/skills/usually
```

或者，项目级地，直接打开仓库 —— agent 会读取 `AGENTS.md`。选取即跑和手动 `add/find/edit/delete` 在所有地方都能用；**自动扫描**是唯一依赖 host 的部分（见[新增平台](CONTRIBUTING.md#adding-a-platform)，了解如何接好一个新 agent 的会话格式）。

---

## 用法

| 命令 | 作用 |
|---|---|
| `/usually` | 重新扫描最近的会话（拉进新的高频词、刷新 `/usually:` 下拉），然后**列出**你的高频提示词（每条都带 `id`）。选一条，它立刻就跑。 |
| `/usually add <text>` | 手动把一条提示词存进口袋。 |
| `/usually find <keyword>` | 在口袋里搜索。 |
| `/usually edit <id> <new text>` | 修改一条已保存的提示词。需要提示词的 **`id`** —— 见下文。 |
| `/usually delete <id\|text>` | 按 `id` 或精确文本删除一条提示词。 |

在没有斜杠命令的 host 上，直接用自然语言描述意图（"列出我的常用提示词"、"保存这条提示词"…）—— skill 会把它映射到对应的操作。

一条提示词在你敲过 **7 次或以上**后会被自动记录。手动添加的提示词永远显示，不管次数多少。

### 查看已保存提示词的两种方式

`/` 下拉菜单**只显示命令名** —— 它**不会**内联预览你的提示词，所以敲 `/usually` + 空格不会多出任何东西。想真正看到它们：

1. **快速运行** —— 敲 **`/usually:`**（带冒号）。下拉里会为每条保存的提示词填上一项（`/usually:<slug>`）；方向键选中一项，回车运行。这是日常的快路径，但它是一份**快照** —— 显示的是上次刷新时的提示词，选中一条**不会**重新扫描。
2. **刷新并列出** —— 运行 **`/usually`**（直接回车，不带参数）。它会**先重新扫描你最近的会话**，把你新近重复 ≥7 次的提示词收进来、补进 `/usually:` 下拉，然后列出全部让你挑。

> **`/usually:` 跑的是你已有的；`/usually` 才会把你最新的高频提示词拉进来。** 快速运行的下拉只在 `/usually`、`add`、`edit`、`delete` 时刷新，所以隔段时间跑一次裸的 `/usually` 来保持它最新。

### 找到提示词的 `id`（用于 `edit` / `delete`）

每条保存的提示词都有一个 8 位的短 `id`，供 `edit` / `delete` 使用。从脚本的 `list` 输出里取，它总会打印出来：

```bash
node ~/.prompt-pocket/pocket.mjs list
# id        count  prompt
# a1b2c3d4   16    Pull the latest main branch and rebuild the project…
# e5f6a7b8   13    Run the build pipeline and deploy to staging…
```

然后按那个 id 编辑/删除（唯一的 **id 前缀**也行，例如 `a1b2`）：

```text
/usually edit a1b2c3d4 Pull main and rebuild from scratch
/usually delete a1b2c3d4
```

`edit` 通过**完整 id**、**id 前缀（若唯一）**或**精确的原始文本**匹配 —— 部分关键词*不会*匹配，这就是为什么你通常传 id。（`delete` 同样接受精确文本。）

### 原生斜杠下拉

每次改动都会为每条保存的提示词重新生成一个轻量命令，所以你的提示词会**直接出现在 host 原生的 `/` 下拉里** —— 方向键选中一项、回车运行，无需往返：

| Host | 敲这个 | 你会得到 |
|---|---|---|
| Claude Code | `/usually` | `/usually:<slug>` 条目（slug = 提示词的可读片段）；方向键选一条来跑 |
| OpenCode | `/usually` | 同样的 `/usually:<slug>` 条目 |

在 **Codex** 上没有斜杠下拉 —— 直接说 **「list my usual prompts」**，回数字选。

slug 是提示词的可读片段（字母/中日韩文字/数字，约 16 字符，绝不在 ASCII 单词中间截断）。完整提示词**被刻意排除在每个条目的描述之外** —— 描述会被预加载进每个会话，所以它们是通用的；完整文本存在命令正文里，挑中条目时才运行。生成的文件写在 `~/.claude/commands/usually/`、`~/.config/opencode/commands/usually/` 和 `~/.codex/prompts/usually-*.md`。只有带 `<!-- prompt-pocket:generated -->` 标记的文件才会被删除，而 Codex 的共享 prompts 目录还额外由 `usually-` 前缀把关 —— 你自己的提示词永远不会被动到。手动改过 store 之后，运行 `pocket.mjs sync` 来重建下拉。

### 为什么是 `/usually` 而不是 `/prompt-pocket:usually`

这一点常把人绊住，所以这里把来龙去脉讲清楚。

**插件永远没法给你一个裸的 `/usually`。** Claude Code *总会*把插件命令命名空间化为 `/<plugin-name>:<command>`，所以插件只能暴露 `/prompt-pocket:usually`。这个前缀是**设计上强制的**（它防止插件之间命名冲突）—— 没有任何 frontmatter 字段、没有 `plugin.json` 设置、也没有任何别名能去掉它（[claude-code#15882](https://github.com/anthropics/claude-code/issues/15882)）。除此之外，插件命令目前**根本不渲染它的 `argument-hint`** 灰色提示，尽管字段就在文件里 —— 这是一个已知 bug（[claude-code#46626](https://github.com/anthropics/claude-code/issues/46626)）。所以 `/prompt-pocket:usually` 既长*又*不显示提示，两者都没法在插件内部修复。

**唯一能得到裸的、全局的 `/usually`（且提示能正常显示）的办法，是一个用户级命令文件**，放在 `~/.claude/commands/usually.md` —— 它是个人/项目命令，不是插件命令，走的是另一条（没有 bug 的）代码路径，会渲染提示。插件没法在安装时写那个文件……**但它发布的脚本可以，在运行时写。** 所以在首次 `/prompt-pocket:usually`（或任何 `scan`/`add`/`edit`/`delete`）时，`sync` 会替你引导生成 `~/.claude/commands/usually.md`（以及 OpenCode 的等价物）。之后：

| 命令 | 来源 | 作用范围 | 提示 | 角色 |
|---|---|---|---|---|
| `/usually` | `sync` 写的用户级文件 | 每个项目 | ✅ 显示 | **日常入口** —— 列出 + 管理 |
| `/usually:<slug>` | 每条提示词生成的文件 | 每个项目 | 不适用 | **立刻运行一条保存的提示词** |
| `/prompt-pocket:usually` | 已安装的插件 | 每个项目 | ❌（bug） | 首次引导 / 兜底 |

这个引导是**幂等且受标记把关的**：只有当 `usually.md` 不存在、或已经带着我们的 `<!-- prompt-pocket:generated -->` 标记时，才会创建它，所以它**永远不会覆盖你自己写的 `usually.md`**。（Codex 上直接说 **「list my usual prompts」**、回数字选。）

### 底层原理（0‑token 核心）

所有状态 —— 存储、频率计数、转录扫描 —— 都由一个确定性的 Node 脚本处理，所以模型从不需要"记住"你的数据：

```bash
node skills/usually/scripts/pocket.mjs list      # 显示口袋
node skills/usually/scripts/pocket.mjs scan      # 扫描 Claude + Codex + OpenCode 会话，记录 ≥7 次的提示词
node skills/usually/scripts/pocket.mjs add  "<text>"
node skills/usually/scripts/pocket.mjs find "<keyword>"
```

---

## 更新

仓库是唯一的真相来源。怎么拉取新版本**只取决于你当初怎么安装** —— 找你那一行。

### Claude Code（作为插件安装）

```text
/plugin marketplace update prompt-pocket-marketplace   # 从 GitHub 重新拉取，更新插件
/reload-plugins                                         # 在本会话激活新版本
```

`/plugin` 菜单里的等价操作：**Marketplaces → prompt-pocket-marketplace → Update marketplace**（然后 `/reload-plugins`）。要想以后再也不用手动做，就在那里选 **Enable auto-update** —— 它会在会话启动时刷新。

你不用碰运行时核心：下次会话启动时，插件的 `SessionStart` hook（`hooks/sync-runtime.mjs`）会从刚装好的插件重新同步 `~/.prompt-pocket/pocket.mjs`，并重新生成 `/usually:` 下拉。你的 store（`~/.prompt-pocket/store.json`）永远不会被动到。（同一个 hook 在首次安装时也会引导生成那个文件。）

### 其他所有 host（Codex / OpenCode / Cursor / Gemini / Copilot）

这些不是插件 —— 它们直接从磁盘读取 skill，所以更新 = 拉取仓库 + 刷新你装过的东西。

**项目级**（你 `git clone` 了仓库并在*里面*运行 agent）—— 一条命令搞定：

```bash
git -C /path/to/prompt-pocket pull          # host 直接读取仓库内的镜像 + pocket.mjs
```

**全局**（你在安装时把 skill 复制进了 agent 的 home 目录）—— 拉取、刷新共享的运行时核心、重新复制你安装时用的**同一个** skill 目录、重建下拉：

```bash
git -C /path/to/prompt-pocket pull
cp /path/to/prompt-pocket/skills/usually/scripts/pocket.mjs ~/.prompt-pocket/pocket.mjs   # 运行时核心（所有 host 共享）
cp -r /path/to/prompt-pocket/.agents/skills/usually ~/.codex/skills/usually              # ← 换成你 host 的目录（见快速开始）
node ~/.prompt-pocket/pocket.mjs sync                                                     # 重建 /usually 下拉
```

> `~/.prompt-pocket/pocket.mjs` 由每个 host 共享。如果你这里也跑 Claude Code，它的 `SessionStart` hook 会免费帮你把那个文件保持最新 —— 其他 host 随后无需 `cp` 就能用上新逻辑；只有每个 host 的**skill 文本**还需要重新复制（项目级的话就 `git pull`）。

---

## 目录结构

```
prompt-pocket/
├── .claude-plugin/              # plugin.json + marketplace.json（可安装）
├── skills/usually/
│   ├── skill.yaml               # 名称、描述、何时使用、能力
│   ├── prompt.md                # skill 的指令（唯一真相来源）
│   ├── scripts/pocket.mjs       # 确定性核心：存储 + CRUD + 跨 agent 扫描
│   └── reference/               # 存储与扫描规则，按需读取
├── commands/usually.md          # Claude / 通用斜杠命令入口
├── scripts/                     # bump-version.mjs（发布）+ sync-mirrors.mjs（skill 编译器）
├── .opencode/                   # OpenCode 原生 skill + /usually 命令
├── .agents/skills/usually/      # 跨 agent SKILL.md（Codex、Copilot、Gemini、Windsurf…）
├── .gemini/skills/usually/      # Gemini 原生 skill 镜像
├── AGENTS.md                    # 开放标准 —— Codex / Cursor / Copilot / Gemini / OpenCode
└── .cursor/rules/               # Cursor 原生规则
```

> `skills/usually/prompt.md`（正文）+ `skills/usually/skill.yaml`（元数据）是唯一真相来源。标准的 `skills/usually/SKILL.md` 和每个 host 镜像（`.claude/`、`.opencode/`、`.agents/`、`.gemini/`、`.cursor/`）都由 `scripts/sync-mirrors.mjs` **从它生成** —— 绝不手改 —— 并且都调用同一个 `pocket.mjs`。

## 贡献

想发版、新增 host 平台、或编辑 skill 文本？见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 许可证

[MIT](LICENSE) © lxb12123
