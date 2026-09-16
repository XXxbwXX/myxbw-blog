# myxbw-blog-admin

`write.myxbw.cn` 的写作后台。

## 用途

- 浏览器新建 / 编辑文章
- 草稿保存在私有仓库 `XXxbwXX/myxbw-blog-drafts`
- 发布后提交到公开仓库 `XXxbwXX/myxbw-blog` 的 `docs/posts/`
- 公开博客自动构建上线
- 支持从本地上传图片/附件，并自动插入 Markdown
- 支持直接粘贴截图、拖拽文件到编辑器上传
- 大图（PNG/JPG/WebP ≥ 300KB）上传前自动压缩（最长边 1920px、质量 0.85），压缩后变小才采用
- 上传默认存入 Vercel Blob（`BLOB_READ_WRITE_TOKEN` 未配置时自动回退为提交到公开仓库），旧 `/uploads/...` 链接格式不变，由博客域名的代理函数兼容
- Markdown 快捷工具栏（加粗/标题/链接/代码/表格等），`Ctrl+S` 保存、`Ctrl+B/I` 加粗斜体
- 编辑内容自动保存到浏览器本地（localStorage），意外关闭后可一键恢复
- 支持导入本地 Markdown 文件到编辑器
- 支持文章管理：筛选已发布/草稿，编辑、查看、发布、下架、删除
- 支持媒体库：查看/搜索已上传文件（Blob 与仓库统一列表），复制链接或 Markdown，删除文件
- 删除媒体文件前，服务端会扫描全部文章和草稿正文，发现引用则拒绝删除并列出引用位置

## 访问保护

管理端单独部署，使用 Vercel Authentication（SSO），未登录 Vercel 的访客无法访问页面和 `/api`。

## 本地上传

- 编辑器正文上方有「上传图片/附件」和「导入本地 md」，也支持直接粘贴截图、拖拽文件进编辑器。
- 上传默认写入 Vercel Blob（路径 `docs/public/uploads/YYYY/MM/`），Markdown 中使用 `/uploads/...` 相对路径，博客域名上的 `api/uploads.js` 代理到 Blob；未配置 Blob 时回退为提交到公开仓库 `docs/public/uploads/YYYY/MM/`（静态文件直接可访问）。
- 单文件限制 3MB，允许 PNG/JPG/GIF/WebP/AVIF/PDF/TXT/MD/ZIP；服务端会校验扩展名和文件头。
- 媒体库面板可查看全部上传文件；删除接口严格校验路径必须位于 `docs/public/uploads/` 下，且会先扫描所有文章/草稿，被引用的文件拒绝删除。
- 上传文件会公开可访问，不要上传隐私文件。

## 环境变量（新增）

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `BLOB_READ_WRITE_TOKEN` | 否 | Vercel Blob 读写 token。未配置时上传回退到公开仓库提交。博客与管理后台两个项目需配置同一 store 的 token |

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
