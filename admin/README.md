# myxbw-blog-admin

`write.myxbw.cn` 的写作后台。

## 用途

- 浏览器新建 / 编辑文章
- 草稿保存在私有仓库 `XXxbwXX/myxbw-blog-drafts`
- 发布后提交到公开仓库 `XXxbwXX/myxbw-blog` 的 `docs/posts/`
- 公开博客自动构建上线
- 支持从本地上传图片/附件到 `docs/public/uploads/`，并自动插入 Markdown
- 支持导入本地 Markdown 文件到编辑器

## 访问保护

管理端单独部署，使用 Vercel Authentication（SSO），未登录 Vercel 的访客无法访问页面和 `/api`。

## 本地上传

- 编辑器正文上方有「上传图片/附件」和「导入本地 md」。
- 上传文件写入公开仓库 `docs/public/uploads/YYYY/MM/`，Markdown 中使用 `/uploads/...` 路径，博客构建后可直接访问。
- 单文件限制 3MB，允许 PNG/JPG/GIF/WebP/AVIF/PDF/TXT/MD/ZIP；服务端会校验扩展名和文件头。
- 上传文件会进入公开仓库，不要上传隐私文件。
- 上传会向公开仓库提交 commit，可能触发一次博客构建。

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
