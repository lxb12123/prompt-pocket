# Prompt Pocket Landing Page — Design

**Date:** 2026-06-28
**Status:** Approved (structure), pending spec review

## Goal

Build a single static landing page so the Zhihu (and other) links point to something
visual instead of the bare repo. Direct trigger: a Zhihu commenter followed the repo link
and found **no demo screenshots** ("要是有效果图的话，会更有吸引力 … 也没有看到效果图").
The README top only has the mascot (`README.md:3`) — no product/effect images. This page
fixes that by showing per-platform effect screenshots front-and-center.

## Hosting

- **GitHub Pages**, served from the repo. Page lives at `docs/index.html` (Pages → "main
  branch / docs folder"). Public URL e.g. `https://lxb12123.github.io/prompt-pocket/`.
- That URL becomes the new link shared on Zhihu (replacing / in addition to the repo link).

## Tech

- **Single static `docs/index.html`** — no build step, no framework. Inline `<style>` and a
  small inline `<script>` only (language toggle + tab switching + smooth scroll + copy
  buttons). This matches the project's existing zero-build, self-contained asset style
  (`assets/social-card.html`).
- Images referenced from `docs/` (copy mascot + effect screenshots into `docs/img/`).

## Language

- **Bilingual, default Chinese**, with a `中 / EN` toggle in the top nav.
- Implemented by tagging text nodes with `data-zh` / `data-en` (or showing/hiding `.lang-zh`
  / `.lang-en` spans) and flipping a `lang` class on `<html>` via JS — no page reload.
- Copy is authored in both languages up front (two strings per visible label).

## Visual style

- **Reuse the existing warm brand** from `assets/social-card.html` / `social-preview.png`
  — NOT the dark/purple tech look of the reference sites (AgentMail / AcmeAI). Those are
  borrowed only for *layout structure*.
- Palette: background gradient `#FDF5EC → #FBE7D3 → #F7DCC4`; terracotta accent `#D2744A`
  (hover/darker `#C96A41`); brown text `#3A2418`; muted brown `#6E5544`; pill chips
  `#FBEADB` bg / `#EFCDAE` border / `#B05B36` text.
- Font stack: system (`-apple-system, "SF Pro Display", "PingFang SC", …`), matching the
  social card.
- **Kangaroo mascot is a background element**, not a big centered foreground logo. It sits
  faded / low-opacity in the hero (off to one side, like `social-preview.png`), with soft
  blob shapes behind the copy. A small mascot icon still appears in the top-nav logo.

## Content principle (hard rule)

**Minimal and curated.** Every section carries only the most useful information — short,
punchy copy, no filler paragraphs. Prefer one tight line over three explanatory ones. The
page should look clean and "designed", not like documentation. If something is already in
the README and isn't essential to a first impression, it does NOT go on the page.

## Page structure

Overall layout is **top-down / vertically stacked**. The ONLY left-right (two-column)
section is **Quick Start**.

```
┌──────────────────────────────────────────────────────┐
│ 🦘 Prompt Pocket    功能  快速开始   中/EN   ⌗GitHub   │  Top nav (sticky)
├──────────────────────────────────────────────────────┤
│  ╭ 跨平台·选了就跑 ╮                                    │
│  别再重复打同一句 Prompt          (faded mascot as      │  Hero
│  存一次，从 / 下拉里选了就跑        background art,       │  warm bg + blobs
│  —— 每个平台都能用                 low opacity)          │
│  [ 快速开始 ]  [ ★ GitHub ]                             │
│  Claude Code · Codex · OpenCode · Cursor · Copilot …   │  platform strip
├──────────────────────────────────────────────────────┤
│  功能亮点  [自动记忆] [选了就跑] [跨平台]                 │  Features (ABOVE quick start)
├──────────────────────────────────────────────────────┤
│  快速开始                                               │  Quick Start (scroll target)
│   Claude Code │ Codex │ OpenCode │ Cursor │ …          │   platform tabs
│  ┌──────────────┐  ┌────────────────────┐             │
│  │ $ /usually 📋│  │ [ effect screenshot ]│            │   command block + image
│  │   ...        │  │ (per-platform)       │            │   (LEFT-RIGHT)
│  └──────────────┘  └────────────────────┘             │
├──────────────────────────────────────────────────────┤
│  Footer: GitHub · author · License · back to top      │
└──────────────────────────────────────────────────────┘
```

### Sections

1. **Top nav (sticky):** small kangaroo logo + "Prompt Pocket"; anchor links 功能 /
   快速开始; `中 / EN` toggle; **GitHub button** (links to `github.com/lxb12123/prompt-pocket`).

2. **Hero:** warm gradient background + soft blobs + faded mascot art. Foreground: a kicker
   pill (`跨平台 · 选了就跑`), headline (`别再重复打同一句 Prompt` / *Stop re-typing the
   same prompt.*), subtitle (`存一次，从 / 下拉里选了就跑 —— 每个平台都能用` / *Save it once,
   then run it from the `/` dropdown — in every session, across every agent.*), two buttons
   (`快速开始` → smooth-scroll to Quick Start; `★ Star on GitHub` → repo), and a platform
   chip strip (Claude Code · Codex · OpenCode · Cursor · Copilot · Gemini · + any AGENTS.md).
   **No "Live Demo" button** — there is no runnable web demo; that exact gap caused the
   Zhihu complaint.

3. **Features (above Quick Start):** three cards, **one tight line each — no paragraphs.**
   These are the three differentiators; nothing else.
   - **选了就跑** — 存好的 prompt 直接进 `/` 下拉，选一下就运行，不用复制粘贴。
   - **自动记忆** — 重复打 7 次的 prompt 自动入袋，不用手动存。
   - **跨平台** — 一个口袋，所有 agent 共用（Claude Code / Codex / OpenCode …）。

4. **Quick Start (the only two-column section, scroll target of the nav button):**
   - A row of **platform tabs**: Claude Code / Codex / OpenCode / Cursor / Copilot / Gemini.
   - **Linked switching:** selecting a tab swaps BOTH the command block (left) AND the effect
     screenshot (right) for that platform — same interaction as the AgentMail panel, and it
     maps directly to "plug in the screenshot for the corresponding platform".
   - **Left:** a command/usage block with a copy button, content per platform, quoted verbatim
     from README (`README.md:78-160`):
     - Claude Code: `/plugin marketplace add lxb12123/prompt-pocket` → `/plugin install
       prompt-pocket@prompt-pocket-marketplace` → first run `/prompt-pocket:usually`, then `/usually`.
     - Codex: `cp -r .agents/skills/usually ~/.codex/skills/usually`, then "list my usual prompts".
     - OpenCode: `cp -r .opencode/skills/usually ~/.config/opencode/skills/usually`, then `/usually`.
     - Cursor: `cp -r .agents/skills/usually ~/.cursor/skills/usually`, then "list my usual prompts".
     - Copilot: `mkdir -p ~/.copilot/skills && cp -r .agents/skills/usually ~/.copilot/skills/usually`.
     - Gemini: `mkdir -p ~/.gemini/skills && cp -r .gemini/skills/usually ~/.gemini/skills/usually`.
     - (A shared one-time step `git clone … && cp pocket.mjs ~/.prompt-pocket/` shown once above the tabs.)
   - **Right:** the **effect screenshot for the selected platform**. User will supply images
     later; until then each tab shows a labelled placeholder box. Desktop = left/right side by
     side; mobile = stacked (image below command block).

5. **Footer:** GitHub link, author (lxb12123), License (from repo), "back to top".

## Responsive

- Desktop ≥ ~900px: Quick Start is two columns (command left, image right).
- Mobile: everything single-column; Quick Start image stacks below the command block; nav
  collapses anchors (keep GitHub + lang toggle visible).

## Assets needed from user

- Per-platform **effect screenshots** (e.g. the Claude one already shown). Page ships with
  placeholders so it works before images arrive; user drops files into `docs/img/` and we
  wire each to its tab.

## Out of scope (YAGNI)

- No build tooling, framework, npm deps, or CSS preprocessor.
- No live/interactive web demo.
- No analytics, cookie banner, or backend.
- No multi-page site — one `index.html`.

## Open items to resolve during implementation

- Confirm exact License name from the repo `LICENSE` file for the footer.
- Decide whether to also update the README to link this page (separate, optional follow-up).
