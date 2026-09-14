# myxbw-blog-admin

`write.myxbw.cn` 的写作后台。

## 用途

- 浏览器新建 / 编辑文章
- 草稿保存在私有仓库 `XXxbwXX/myxbw-blog-drafts`
- 发布后提交到公开仓库 `XXxbwXX/myxbw-blog` 的 `docs/posts/`
- 公开博客自动构建上线

## 访问保护

管理端单独部署，使用 Vercel Authentication（SSO），未登录 Vercel 的访客无法访问页面和 `/api`。

## 环境变量

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `GITHUB_TOKEN` | 是 | fine-grained token，需同时对 `myxbw-blog` 和 `myxbw-blog-drafts` 有 `Contents: Read and write` |
| `GITHUB_OWNER` | 否 | 默认 `XXxbwXX` |
| `GITHUB_PUBLIC_REPO` | 否 | 默认 `myxbw-blog` |
| `GITHUB_DRAFTS_REPO` | 否 | 默认 `myxbw-blog-drafts` |
| `GITHUB_BRANCH` | 否 | 默认 `main` |
| `ADMIN_ALLOWED_ORIGINS` | 否 | 额外允许的来源，逗号分隔 |

## 本地开发

```bash
npm install
npm run dev
```

本地 API 需要 `GITHUB_TOKEN`；生产环境密钥只放在 Vercel 环境变量，不提交到仓库。
