# Prompt Pocket Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single static, bilingual GitHub Pages landing page that gives the Zhihu/repo link a visual destination with per-platform effect screenshots.

**Architecture:** One self-contained `docs/index.html` — inline `<style>` + small inline `<script>` (language toggle, platform-tab switching, smooth scroll, copy buttons). No build, no framework, no deps. Mascot + screenshots live in `docs/img/`.

**Tech Stack:** Plain HTML5, CSS (fl/grid, CSS custom properties), vanilla JS. GitHub Pages from `main`/`docs`.

## Global Constraints

- **Single file:** all markup/CSS/JS in `docs/index.html`. No npm, no framework, no CSS preprocessor, no external JS/CSS CDNs except a system font stack.
- **Warm brand palette only** (no dark/purple tech look): bg gradient `#FDF5EC → #FBE7D3 → #F7DCC4`; accent `#D2744A`; accent-dark `#C96A41`; text `#3A2418`; muted `#6E5544`; chip bg `#FBEADB` / border `#EFCDAE` / text `#B05B36`; card/surface `#FFFFFF`/`#FFFBF5`.
- **Font:** `-apple-system, "SF Pro Display", "Helvetica Neue", "PingFang SC", Arial, sans-serif`; mono `ui-monospace, "SF Mono", Menlo, monospace`.
- **Bilingual, default Chinese.** Every visible string has zh + en. Toggle flips `lang` class on `<html>`; no reload.
- **Content principle:** minimal & curated — one tight line per idea, no filler. Looks designed, not like docs.
- **Layout:** top-down stacked; the ONLY two-column section is Quick Start (command left, image right; stacks on mobile).
- **No "Live Demo" button.** No analytics/backend/cookies.
- **Mascot is background art** in the hero (faded, low opacity), plus a small logo glyph in nav.
- Repo URL: `https://github.com/lxb12123/prompt-pocket`. License: MIT © 2026 lxb12123.

## File Structure

- Create: `docs/index.html` — the entire page.
- Create: `docs/img/prompt-pocket-mascot.png` — copied from `assets/prompt-pocket-mascot.png`.
- Create: `docs/img/.gitkeep` placeholders conceptually — effect screenshots `docs/img/demo-claude.png` etc. added by user later; page must not break when missing (placeholder boxes).

## Bilingual mechanism (used by every task)

Each translatable element carries two child spans:
```html
<span class="i18n" data-zh="别再重复打同一句 Prompt" data-en="Stop re-typing the same prompt."></span>
```
JS sets `textContent` from the active lang on load and on toggle. `lang` state stored in a JS variable (no persistence needed). Default `zh`.

---

### Task 1: Scaffold + nav + hero

**Files:**
- Create: `docs/index.html`
- Create: `docs/img/prompt-pocket-mascot.png` (copy of `assets/prompt-pocket-mascot.png`)

**Interfaces:**
- Produces: the `.i18n` span convention; CSS custom properties `--bg1/--bg2/--bg3/--accent/--accent-dark/--text/--muted/--chip-bg/--chip-border/--chip-text`; a `<header class="nav">`; a `<section class="hero">`; anchor ids `#features` and `#quickstart` (targets created in later tasks); a `data-lang` toggle button `#langToggle`.

- [ ] **Step 1: Copy the mascot asset**

```bash
mkdir -p docs/img && cp assets/prompt-pocket-mascot.png docs/img/prompt-pocket-mascot.png
```

- [ ] **Step 2: Create `docs/index.html` with head, palette vars, nav, and hero**

Head: `<!doctype html>`, `<html lang="zh">`, meta charset + viewport, `<title>Prompt Pocket</title>`, meta description (zh). Inline `<style>` defining `:root` custom properties (exact values from Global Constraints), `body{font-family:…; color:var(--text); background:linear-gradient(135deg,var(--bg1),var(--bg2) 55%,var(--bg3));}`, reset (`*{margin:0;padding:0;box-sizing:border-box}`).

Nav (`<header class="nav">`, sticky, translucent bg):
- left: small mascot `<img src="img/prompt-pocket-mascot.png" width="28">` + `<strong>Prompt Pocket</strong>`
- center: anchor links `<a href="#features">` (zh 功能 / en Features), `<a href="#quickstart">` (zh 快速开始 / en Quick Start)
- right: `<button id="langToggle">中 / EN</button>`; GitHub link `<a class="btn-ghost" href="https://github.com/lxb12123/prompt-pocket">⌗ GitHub</a>`

Hero (`<section class="hero">`, `position:relative; overflow:hidden`):
- faded background mascot: `<img class="hero-bg" src="img/prompt-pocket-mascot.png">` positioned right/behind, `opacity:.12`, large, `pointer-events:none`, `z-index:0`; plus two `.blob` divs (peach circles, like `assets/social-card.html` b1/b2).
- foreground `.hero-inner` (`position:relative; z-index:1`):
  - kicker pill: zh `跨平台 · 选了就跑` / en `Cross-platform · pick and run`
  - `<h1>`: zh `别再重复打同一句 Prompt` / en `Stop re-typing the same prompt.`
  - `<p class="sub">`: zh `存一次，从 / 下拉里选了就跑 —— 每个平台都能用。` / en `Save it once, then run it from the / dropdown — in every session, across every agent.`
  - buttons: `<a class="btn-primary" href="#quickstart">` zh 快速开始 / en Quick Start; `<a class="btn-ghost" href="https://github.com/lxb12123/prompt-pocket">` `★ Star on GitHub`
  - platform chip strip: chips Claude Code · Codex · OpenCode · Cursor · Copilot · Gemini · (dashed) `+ 任何 AGENTS.md` / `+ any AGENTS.md`

Button styles: `.btn-primary{background:var(--accent);color:#fff;border-radius:999px;padding:12px 22px;font-weight:700}` hover `var(--accent-dark)`; `.btn-ghost{border:1px solid var(--chip-border);color:var(--text);border-radius:999px;padding:11px 20px}`. Chips reuse social-card `.chip` style.

Add empty `<section id="features"></section>` and `<section id="quickstart"></section>` placeholders so anchors resolve.

- [ ] **Step 3: Add the i18n + toggle script (minimal)**

Inline `<script>` at end of body:
```html
<script>
  let lang = 'zh';
  function applyLang(){
    document.documentElement.lang = lang;
    document.querySelectorAll('.i18n').forEach(function(el){
      el.textContent = el.getAttribute(lang === 'zh' ? 'data-zh' : 'data-en');
    });
    document.getElementById('langToggle').textContent = lang === 'zh' ? 'EN' : '中文';
  }
  document.getElementById('langToggle').addEventListener('click', function(){
    lang = lang === 'zh' ? 'en' : 'zh';
    applyLang();
  });
  applyLang();
</script>
```

- [ ] **Step 4: Verify in browser**

Run: `open docs/index.html`
Expected: Nav with logo + links + GitHub + toggle; hero shows kicker, big headline, subtitle, two buttons, chip strip; faded mascot visible behind hero copy on warm gradient. Click toggle → all text flips zh↔en, button label flips. Click "快速开始" → page scrolls to (empty) `#quickstart`.

- [ ] **Step 5: Commit**

```bash
git add docs/index.html docs/img/prompt-pocket-mascot.png
git commit -m "feat(landing): scaffold page, nav, hero, bilingual toggle"
```

---

### Task 2: Features section (3 curated cards)

**Files:**
- Modify: `docs/index.html` (fill `<section id="features">`)

**Interfaces:**
- Consumes: `.i18n` convention, palette vars from Task 1.
- Produces: `.features` grid + `.card` style reused conceptually by Quick Start.

- [ ] **Step 1: Fill the features section**

Section heading `<h2 class="i18n" data-zh="功能亮点" data-en="Highlights">`. A responsive grid `.features` (3 cols desktop, 1 col mobile via `@media(max-width:900px)`). Three `.card`s (white/`#FFFBF5`, radius 16px, subtle shadow, small emoji/icon + bold title + ONE line):
- 选了就跑 / Pick & run — zh `存好的 prompt 直接进 / 下拉，选一下就运行，不用复制粘贴。` / en `Saved prompts drop into the native / dropdown — pick one, it runs. No copy-paste.`
- 自动记忆 / Auto-remember — zh `重复打 7 次的 prompt 自动入袋，不用手动存。` / en `Repeat a prompt 7× and it's pocketed automatically.`
- 跨平台 / Cross-platform — zh `一个口袋，所有 agent 共用：Claude Code、Codex、OpenCode……` / en `One pocket shared by every agent: Claude Code, Codex, OpenCode…`

No paragraphs beyond the single line each.

- [ ] **Step 2: Verify in browser**

Run: `open docs/index.html`
Expected: Below hero, a "功能亮点" heading and three clean cards in a row (one line each). Toggle flips all three. Narrow the window → cards stack to one column.

- [ ] **Step 3: Commit**

```bash
git add docs/index.html
git commit -m "feat(landing): features section (3 curated cards)"
```

---

### Task 3: Quick Start — platform tabs + command block + image (the two-column section)

**Files:**
- Modify: `docs/index.html` (fill `<section id="quickstart">`)

**Interfaces:**
- Consumes: palette + i18n from Task 1.
- Produces: `.tabs` with `data-platform` buttons; `.qs-grid` two-column; `#cmdBlock` (left) and `#demoImg`+`#demoCaption` (right); a JS `PLATFORMS` data object; `switchPlatform(key)` function; per-platform copy button.

- [ ] **Step 1: Add the Quick Start markup**

Heading `<h2 class="i18n" data-zh="快速开始" data-en="Quick Start">`.

One-time shared step shown above the tabs (small note + code + copy btn):
zh note `先做一次（让核心脚本随处可用）：` / en `One-time setup (makes the core reachable anywhere):`
```text
git clone https://github.com/lxb12123/prompt-pocket && cd prompt-pocket
mkdir -p ~/.prompt-pocket && cp skills/usually/scripts/pocket.mjs ~/.prompt-pocket/pocket.mjs
```

Tabs row `.tabs`: buttons with `data-platform` = `claude|codex|opencode|cursor|copilot|gemini`, labels Claude Code / Codex / OpenCode / Cursor / Copilot / Gemini. First (`claude`) has class `active`.

Two-column `.qs-grid` (grid 2 cols desktop; 1 col mobile, image below):
- Left `.qs-cmd`: a `<pre id="cmdBlock">` + a copy button `#copyBtn` (zh 复制 / en Copy).
- Right `.qs-demo`: `<img id="demoImg">` inside a framed box (radius 14px, border `--chip-border`, shadow) with `onerror` to reveal a `.placeholder` (dashed box, text zh `效果图待补 · <平台>` / en `Screenshot coming · <platform>`); `<p id="demoCaption" class="caption">`.

- [ ] **Step 2: Add the platform data + switching script**

Append to the inline script a `PLATFORMS` map. Commands quoted verbatim from `README.md:78-160`:
```js
const PLATFORMS = {
  claude:   { cmd: "/plugin marketplace add lxb12123/prompt-pocket\n/plugin install prompt-pocket@prompt-pocket-marketplace\n# first run once:\n/prompt-pocket:usually   # then just /usually",
              img: "img/demo-claude.png",
              cap_zh: "Claude Code：原生方向键菜单，选了就跑。", cap_en: "Claude Code: native arrow-key menu, pick and run." },
  codex:    { cmd: "cp -r .agents/skills/usually ~/.codex/skills/usually\n# then say: list my usual prompts",
              img: "img/demo-codex.png",
              cap_zh: "Codex：编号列表，说一句即可。", cap_en: "Codex: numbered list, just ask." },
  opencode: { cmd: "cp -r .opencode/skills/usually ~/.config/opencode/skills/usually\n# then type /usually",
              img: "img/demo-opencode.png",
              cap_zh: "OpenCode：/usually 直接用。", cap_en: "OpenCode: type /usually." },
  cursor:   { cmd: "cp -r .agents/skills/usually ~/.cursor/skills/usually\n# then ask: list my usual prompts",
              img: "img/demo-cursor.png",
              cap_zh: "Cursor：规则自动加载，问一句即可。", cap_en: "Cursor: rules auto-load, just ask." },
  copilot:  { cmd: "mkdir -p ~/.copilot/skills && cp -r .agents/skills/usually ~/.copilot/skills/usually\n# agent mode: list my usual prompts",
              img: "img/demo-copilot.png",
              cap_zh: "GitHub Copilot：agent 模式问一句。", cap_en: "GitHub Copilot: ask in agent mode." },
  gemini:   { cmd: "mkdir -p ~/.gemini/skills && cp -r .gemini/skills/usually ~/.gemini/skills/usually\n# then ask: list my usual prompts",
              img: "img/demo-gemini.png",
              cap_zh: "Gemini CLI：读取 SKILL.md，问一句即可。", cap_en: "Gemini CLI: reads SKILL.md, just ask." },
};
let platform = 'claude';
function renderPlatform(){
  const p = PLATFORMS[platform];
  document.getElementById('cmdBlock').textContent = p.cmd;
  const img = document.getElementById('demoImg');
  img.src = p.img; img.alt = platform + ' demo';
  document.getElementById('demoCaption').textContent = (lang === 'zh' ? p.cap_zh : p.cap_en);
}
document.querySelectorAll('.tabs button').forEach(function(b){
  b.addEventListener('click', function(){
    document.querySelectorAll('.tabs button').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    platform = b.getAttribute('data-platform');
    renderPlatform();
  });
});
document.getElementById('copyBtn').addEventListener('click', function(){
  navigator.clipboard.writeText(document.getElementById('cmdBlock').textContent);
  this.textContent = lang === 'zh' ? '已复制' : 'Copied';
  const self = this; setTimeout(function(){ self.textContent = lang === 'zh' ? '复制' : 'Copy'; }, 1500);
});
```
Call `renderPlatform()` inside `applyLang()` (so caption follows language) and once at startup.

- [ ] **Step 3: Verify in browser**

Run: `open docs/index.html`
Expected: Quick Start shows one-time setup block, a tab row (Claude active), left command block + Copy button, right framed image area showing a "效果图待补" placeholder (images not added yet). Click Codex/OpenCode/… → command text AND caption switch together; active tab highlights. Click Copy → button shows 已复制/Copied then reverts. Toggle language → caption + button labels follow. On narrow window the image stacks below the command block.

- [ ] **Step 4: Commit**

```bash
git add docs/index.html
git commit -m "feat(landing): quick start with linked platform tabs, command + demo image"
```

---

### Task 4: Footer + responsive polish + Pages config

**Files:**
- Modify: `docs/index.html`

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1: Add footer**

`<footer>`: GitHub link, `MIT © 2026 lxb12123`, and a "回到顶部 / Back to top" link (`href="#"`). Muted text, centered, small.

- [ ] **Step 2: Responsive + final polish pass**

Add/verify `@media (max-width: 900px)`: features → 1 col; `.qs-grid` → 1 col (image below command); nav center anchors hidden (keep logo + GitHub + toggle); hero h1 font-size scales down (`clamp(40px, 8vw, 88px)`). Ensure max content width (`.wrap{max-width:1080px;margin:0 auto;padding:0 24px}`) applied to nav/hero/features/quickstart/footer.

- [ ] **Step 3: Verify in browser at two widths**

Run: `open docs/index.html`
Expected: Desktop — centered max-width content, Quick Start two columns. Resize to ~375px — everything single column, image below command block, nav anchors hidden, headline not overflowing. Language toggle still flips everything.

- [ ] **Step 4: Commit**

```bash
git add docs/index.html
git commit -m "feat(landing): footer + responsive polish"
```

- [ ] **Step 5: (Manual, by user) Enable GitHub Pages**

Note for user: GitHub repo → Settings → Pages → Source = `main` branch, `/docs` folder. URL becomes `https://lxb12123.github.io/prompt-pocket/`. (Not automatable here; document in PR description.)

---

## Self-Review

**Spec coverage:**
- Hosting (GitHub Pages /docs) → Task 4 Step 5. ✅
- Single static file → Task 1. ✅
- Bilingual default zh → Task 1 Step 3. ✅
- Warm palette, mascot as bg → Task 1 Step 2. ✅
- Top-down layout, only Quick Start two-column → Tasks 1-4. ✅
- Features above Quick Start, 3 one-line cards → Task 2. ✅
- Quick Start platform tabs linking command + image → Task 3. ✅
- Per-platform commands verbatim from README → Task 3 Step 2. ✅
- Effect images with safe placeholders (user supplies later) → Task 3 Step 1 (`onerror`). ✅
- No Live Demo button → Task 1 hero (omitted). ✅
- Footer (GitHub, MIT, author) → Task 4. ✅
- Content principle (minimal) → enforced in copy throughout. ✅

**Placeholder scan:** No TBD/TODO in steps; all copy + commands + JS are concrete. The `docs/img/demo-*.png` files are intentionally user-supplied — handled gracefully by `onerror` placeholder, not a plan gap.

**Type consistency:** `switchPlatform` referenced in Interfaces is implemented as tab click handlers + `renderPlatform()`; ids `cmdBlock`/`demoImg`/`demoCaption`/`copyBtn`/`langToggle` and classes `.i18n`/`.tabs`/`.qs-grid`/`.card` are consistent across tasks.
