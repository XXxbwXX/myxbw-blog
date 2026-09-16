---
title: VitePress 建站踩坑清单：死链检查、管道退出码与部署细节
date: '2026-09-17'
description: 一晚上连建两个 VitePress 站踩到的坑：死链检查拦构建、管道吃掉退出码、RSS 生成顺序，整理成一份可复用的检查清单。
tags: [VitePress, 建站, 工具]
readingTime: 5
---

# VitePress 建站踩坑清单：死链检查、管道退出码与部署细节

一夜之间从零搭了一个教程站和一个工具站，加上之前的几个学习站，VitePress 的坑基本集齐了。这篇文章按「写作 → 构建 → 部署」的时间线整理，每条都是真实踩过的。

## 1. 死链检查：写作时的隐形护栏

VitePress 构建时会扫描全站内链，指向不存在页面的链接直接**构建失败**，报 `N dead link(s) found`。

坑点在于写连载教程：`01-start.md` 结尾想放「下一篇」链接，可 `02` 还没写。我的教训是一晚上栽了两次，最终形成一条纪律：

> **链接只在目标文件真实存在时才写**，没写的章节一律用纯文字占位，写完再补链。

另外两个相关开关：`ignoreDeadLinks: true` 可以关掉检查（不建议，护栏拆了）；`sitemap.hostname` 配置后构建会顺带产出 `sitemap.xml`，配合 `docs/public/robots.txt` 正好凑齐 SEO 基础件。

## 2. 管道会吃掉退出码

自动化脚本里这行命令差点酿成事故：

```bash
npm run docs:build 2>&1 | tail -2 && git commit -m "x"
```

管道之后 `&&` 拿到的是 `tail` 的退出码（永远是 0），**构建失败照样往下提交**，坏提交就这么进了历史。修正写法：构建和提交拆成两步，先肉眼确认 `build complete` 再提交；或者用 `set -o pipefail`。

## 3. RSS 生成要挂在构建链后面

`feed.xml` 不是 VitePress 内置的，思路是 build 完成后跑一个 Node 脚本扫 `docs/posts/*.md` 的 frontmatter 生成。关键在 `package.json` 里的接线顺序：

```json
"docs:build": "vitepress build docs && node scripts/gen-rss.mjs"
```

用 `&&` 串在构建后（这里正是需要退出码传递的地方），这样 CI/CD 一条命令就能同时产出页面和 RSS。验证方式：构建后 `grep -c "<item>" docs/.vitepress/dist/feed.xml`，条数应该等于文章数。

## 4. 本地搜索与中文化

`themeConfig.search.provider: 'local'` 零依赖开箱即用，中文分词效果对内容站够用。默认按钮是英文，记得补一份中文翻译配置（buttonText「搜索」、noResultsText「没有找到结果」那一段），观感差距很大。

## 5. 部署侧的三个细节

- **输出目录**是 `docs/.vitepress/dist`，不是项目根的 dist，Vercel 设置里别填错；
- **纯静态站不必上框架预设**，选 Other + 输出目录即可，构建命令 `npm run docs:build`；
- 多站矩阵建议**模板复用而非复制粘贴**：侧边栏自动生成脚本、安全响应头、搜索中文化配置抽成一份母版，新站 10 分钟起套。

## 6. 提交前检查清单

- [ ] `npm run docs:build` 全绿（先看输出，再提交）
- [ ] `feed.xml` 条数 = 文章数
- [ ] 新增页面在侧边栏/目录里可达
- [ ] `git status` 干净后再 push

踩坑不可怕，同一块石头绊两次才可怕。这份清单会随建站继续更新。
