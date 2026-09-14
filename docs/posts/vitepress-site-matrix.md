---
title: 用 VitePress 维护一个站点矩阵：我的踩坑清单
date: '2026-09-13'
description: 一套 VitePress 站点从本地构建到 Vercel、DNS、门户和移动端验收的完整检查清单。
tags: [VitePress, 建站, 前端]
readingTime: 7
---

# 用 VitePress 维护一个站点矩阵：我的踩坑清单

当站点从一个变成五个，问题就不再是“怎么搭”，而是“怎么保证每次上线都不漏东西”。下面是我维护 `myxbw.cn` 站点矩阵时整理出的检查清单，按顺序做基本不会翻车。

## 1. 新站五件套

一个学习站上线，至少要做完这五步：

1. GitHub 建仓库并推送源码；
2. Vercel 导入项目并绑定域名；
3. 阿里云添加 CNAME，主机记录是子域名前缀，记录值 `cname.vercel-dns.com`；
4. 门户页加卡片；
5. `curl` 验收 HTTP 状态码。

其中第 2 步和第 3 步的顺序不要反。先让 Vercel 知道域名，再去解析，能少等很多时间。

## 2. 构建必须零报错

推送前固定执行：

```bash
npm run docs:build
```

构建失败时不要靠“再 push 一次”解决。Vercel 构建环境和本地不一定完全一致，但本地都过不了，线上大概率也过不了。

Vercel 的输出目录通常配置为：

```json
{
  "buildCommand": "npm run docs:build",
  "outputDirectory": "docs/.vitepress/dist",
  "cleanUrls": true
}
```

## 3. sitemap 和 robots 不要漏

只配置 `cleanUrls` 不会自动生成 sitemap。VitePress 需要显式写 hostname：

```js
export default defineConfig({
  sitemap: { hostname: 'https://example.myxbw.cn' }
})
```

然后放一个 `docs/public/robots.txt`：

```txt
User-agent: *
Allow: /

Sitemap: https://example.myxbw.cn/sitemap.xml
```

上线后记得请求一次 `https://子域名/sitemap.xml`，确认不是 404。

## 4. 移动端必须单独验

桌面浏览器缩小窗口不等于真实移动端。我之前被无头浏览器的截图骗过：截图看着正常，真机上却横向溢出。

更可靠的方式是用 CDP 设置设备尺寸，例如 320×568 和 390×844，再检查：

- `document.documentElement.scrollWidth` 是否大于视口宽度；
- 图片和卡片有没有超出容器；
- `background-attachment: fixed` 在移动端是否导致滚动卡顿；
- `backdrop-filter` 有没有加 `-webkit-` 前缀。

## 5. Git 只走 SSH

本机 GitHub 网页打不开时，别顺手把 remote 改成 HTTPS。保留 SSH：

```bash
git remote -v
# origin  git@github.com:XXxbwXX/example.git (fetch)
# origin  git@github.com:XXxbwXX/example.git (push)
```

推送：

```bash
git push origin main
```

如果 SSH 偶发断开，可以临时加连接参数重试：

```bash
GIT_SSH_COMMAND='ssh -o ConnectTimeout=20 -o StrictHostKeyChecking=accept-new' git push origin main
```

## 6. 统一导航要最后加

每个站都加自己的侧边栏和页脚没问题，但跨站入口最好统一维护：

- 门户页负责全站总入口；
- 每个学习站的 footer 放常用姊妹站；
- 文章站的角色页放统一导航。

这样新增站点时，改动范围可控，不会每个页面都改一遍。

## 小结

站点矩阵最难的不是技术，而是流程一致性。把“建站、构建、SEO、移动端、发布、导航”固定成清单，每加一个站就按表打勾，出错概率会低很多。
