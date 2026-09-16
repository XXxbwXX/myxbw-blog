import { createHash } from 'node:crypto'
import matter from 'gray-matter'
import {
  hasBlob,
  headBlobObject,
  listBlobObjects,
  putBlobObject,
  deleteBlobObject
} from '../server/blob.js'
import {
  BRANCH,
  DRAFTS_REPO,
  PUBLIC_REPO,
  deleteFile,
  getFile,
  getFileMeta,
  hasToken,
  listDirectory,
  listTree,
  pathFor,
  putBinaryFile,
  putFile,
  repoFor
} from '../server/github.js'
import {
  isAllowedRequest,
  json,
  rateLimit,
  readJsonBody,
  sanitizeUploadName,
  validateMarkdownPayload,
  validatePayload,
  validateSlug,
  validateUploadPath,
  validateUploadPayload
} from '../server/security.js'

const UPLOAD_DIR = 'docs/public/uploads'
const UPLOAD_EXTENSION_PATTERN = /\.(png|jpe?g|gif|webp|avif|pdf|txt|md|zip)$/i

function publicError(error) {
  const message = String(error?.message || '')
  const code = String(error?.code || '')
  if (message === 'token_missing' || code === 'token_missing') return { status: 503, body: { error: 'token_missing' } }
  if (message === 'body_too_large') return { status: 413, body: { error: 'body_too_large' } }
  if (message === 'file_too_large') return { status: 413, body: { error: 'file_too_large' } }
  if (message === 'draft_conflict') return { status: 409, body: { error: 'draft_conflict' } }
  if (message === 'protected_post') return { status: 400, body: { error: 'protected_post' } }
  if (message === 'upload_in_use') return { status: 409, body: { error: 'upload_in_use', refs: error.refs || [] } }
  if (message.startsWith('invalid_') || message === 'too_many_tags' || message === 'content_too_large') {
    return { status: 400, body: { error: message } }
  }
  if (error?.status === 404) return { status: 404, body: { error: 'not_found' } }
  if (error?.status === 409) return { status: 409, body: { error: 'conflict' } }
  if (error?.status === 401 || error?.status === 403) return { status: 502, body: { error: 'github_auth_error' } }
  if (error?.status === 429) return { status: 503, body: { error: 'github_rate_limited' } }
  return { status: 500, body: { error: 'server_error' } }
}

function itemFromFile(file, parsed) {
  const slug = file.name.replace(/\.md$/, '')
  const data = parsed.data || {}
  return {
    slug,
    title: String(data.title || slug),
    date: String(data.date || ''),
    description: String(data.description || ''),
    tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
    readingTime: data.readingTime ? Number(data.readingTime) : null,
    sha: file.sha
  }
}

async function loadItems(type) {
  const repo = repoFor(type)
  const dir = type === 'draft' ? 'drafts' : 'docs/posts'
  const files = await listDirectory(repo, dir)
  const markdownFiles = files
    .filter((file) => file.type === 'file' && file.name.endsWith('.md'))
    .filter((file) => !(type === 'post' && file.name === 'index.md'))
    .filter((file) => !(type === 'draft' && file.name.toLowerCase() === 'readme.md'))
    .slice(0, 200)

  const items = await Promise.all(
    markdownFiles.map(async (file) => {
      const detail = await getFile(repo, `${dir}/${file.name}`)
      if (!detail) return null
      const parsed = matter(detail.content)
      return itemFromFile(file, parsed)
    })
  )

  return items
    .filter(Boolean)
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
}

async function getOne(type, slug) {
  const repo = repoFor(type)
  const detail = await getFile(repo, pathFor(type, slug))
  if (!detail) {
    const error = new Error('not_found')
    error.status = 404
    throw error
  }
  const parsed = matter(detail.content)
  const data = parsed.data || {}
  return {
    slug,
    type,
    title: String(data.title || slug),
    date: String(data.date || ''),
    description: String(data.description || ''),
    tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
    readingTime: data.readingTime ? Number(data.readingTime) : null,
    body: parsed.content.replace(/^\s*\n/, '')
  }
}

function composeMarkdown(payload) {
  const data = {
    title: payload.title,
    date: payload.date,
    description: payload.description,
    tags: payload.tags,
    readingTime: payload.readingTime
  }
  const body = `${payload.body.trimEnd()}\n`
  return matter.stringify(body, data)
}

async function saveOne(payload) {
  const repo = repoFor(payload.type)
  const path = pathFor(payload.type, payload.slug)
  const markdown = composeMarkdown(payload)
  const label = payload.type === 'draft' ? 'draft' : 'post'
  const result = await putFile(repo, path, markdown, `${label}: ${payload.title}`)
  return { ok: true, slug: payload.slug, type: payload.type, commit: result.commit }
}

async function publishOne(slug) {
  const draft = await getFile(DRAFTS_REPO, `drafts/${slug}.md`)
  if (!draft) {
    const error = new Error('not_found')
    error.status = 404
    throw error
  }
  const parsed = matter(draft.content)
  const title = String(parsed.data?.title || slug)
  await putFile(PUBLIC_REPO, `docs/posts/${slug}.md`, draft.content, `post: ${title}`)
  await deleteFile(DRAFTS_REPO, `drafts/${slug}.md`, `post: ${title} (remove draft)`)
  return { ok: true, slug, url: `/posts/${slug}` }
}

const PROTECTED_POST_SLUGS = new Set(['index'])

async function deleteOne(type, slug) {
  if (type === 'post') {
    if (PROTECTED_POST_SLUGS.has(slug)) {
      const error = new Error('protected_post')
      error.status = 400
      throw error
    }
    await deleteFile(PUBLIC_REPO, `docs/posts/${slug}.md`, `post: delete ${slug}`)
    return { ok: true, slug, type }
  }

  await deleteFile(DRAFTS_REPO, `drafts/${slug}.md`, `draft: delete ${slug}`)
  return { ok: true, slug, type: 'draft' }
}

async function unpublishOne(slug) {
  if (PROTECTED_POST_SLUGS.has(slug)) {
    const error = new Error('protected_post')
    error.status = 400
    throw error
  }
  const source = await getFile(PUBLIC_REPO, `docs/posts/${slug}.md`)
  if (!source) {
    const error = new Error('not_found')
    error.status = 404
    throw error
  }
  const existingDraft = await getFile(DRAFTS_REPO, `drafts/${slug}.md`)
  if (existingDraft) {
    const error = new Error('draft_conflict')
    error.status = 409
    throw error
  }

  await putFile(DRAFTS_REPO, `drafts/${slug}.md`, source.content, `unpublish: ${slug}`)
  await deleteFile(PUBLIC_REPO, `docs/posts/${slug}.md`, `unpublish: ${slug} (remove post)`)
  return { ok: true, slug, type: 'draft' }
}

function shanghaiMonth(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit'
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return { year: values.year, month: values.month }
}

async function uploadOne(payload) {
  const file = validateUploadPayload(payload)
  const { year, month } = shanghaiMonth()
  const hash = createHash('sha256').update(file.buffer).digest('hex').slice(0, 12)
  const safeName = `${hash}-${sanitizeUploadName(file.filename, file.extension)}`
  const objectPath = `${UPLOAD_DIR}/${year}/${month}/${safeName}`
  const url = `/uploads/${year}/${month}/${encodeURIComponent(safeName)}`

  if (hasBlob()) {
    await putBlobObject(objectPath, file.buffer, file.mime)
    return { ok: true, kind: file.kind, name: safeName, url, storage: 'blob', size: file.size }
  }

  const existing = await getFileMeta(PUBLIC_REPO, objectPath)
  if (!existing) {
    await putBinaryFile(PUBLIC_REPO, objectPath, file.buffer.toString('base64'), `upload: ${safeName}`)
  }
  return { ok: true, kind: file.kind, name: safeName, url, storage: 'repo', size: file.size }
}

async function listUploadsOne() {
  const tasks = [listTree(PUBLIC_REPO, `${UPLOAD_DIR}/`)]
  if (hasBlob()) tasks.push(listBlobObjects(`${UPLOAD_DIR}/`).catch(() => []))
  const [repoEntries, blobEntries = []] = await Promise.all(tasks)

  const toKind = (name) => (/\.(png|jpe?g|gif|webp|avif)$/i.test(name) ? 'image' : 'file')
  const repoItems = repoEntries
    .filter((entry) => UPLOAD_EXTENSION_PATTERN.test(entry.path))
    .map((entry) => {
      const parts = entry.path.split('/')
      const name = parts[parts.length - 1]
      const year = parts[parts.length - 3] || ''
      const month = parts[parts.length - 2] || ''
      return {
        name,
        path: entry.path,
        size: Number(entry.size) || 0,
        kind: toKind(name),
        storage: 'repo',
        url: `/uploads/${year}/${month}/${encodeURIComponent(name)}`
      }
    })

  const blobItems = blobEntries
    .filter((entry) => UPLOAD_EXTENSION_PATTERN.test(entry.pathname || ''))
    .map((entry) => {
      const parts = entry.pathname.split('/')
      const name = parts[parts.length - 1]
      const year = parts[parts.length - 3] || ''
      const month = parts[parts.length - 2] || ''
      return {
        name,
        path: entry.pathname,
        size: Number(entry.size) || 0,
        kind: toKind(name),
        storage: 'blob',
        url: `/uploads/${year}/${month}/${encodeURIComponent(name)}`
      }
    })

  return [...blobItems, ...repoItems]
    .sort((a, b) => b.path.localeCompare(a.path))
    .slice(0, 500)
}

async function findUploadReferences(objectName) {
  const targets = [
    { type: 'post', repo: PUBLIC_REPO, dir: 'docs/posts' },
    { type: 'draft', repo: DRAFTS_REPO, dir: 'drafts' }
  ]
  const refs = []
  for (const target of targets) {
    const files = await listDirectory(target.repo, target.dir)
    const markdownFiles = files.filter((file) => file.type === 'file' && file.name.endsWith('.md'))
    await Promise.all(
      markdownFiles.map(async (file) => {
        const detail = await getFile(target.repo, `${target.dir}/${file.name}`)
        if (detail && detail.content.includes(objectName)) {
          refs.push(`${target.type === 'post' ? '文章' : '草稿'}:${file.name.replace(/\.md$/, '')}`)
        }
      })
    )
  }
  return refs
}

async function deleteUploadOne(payload) {
  const path = validateUploadPath(payload.path)
  const objectName = path.split('/').pop()

  const refs = await findUploadReferences(objectName)
  if (refs.length) {
    const error = new Error('upload_in_use')
    error.refs = refs
    throw error
  }

  if (hasBlob()) {
    const meta = await headBlobObject(path)
    if (meta) {
      await deleteBlobObject(path)
      return { ok: true, path, storage: 'blob' }
    }
  }

  const result = await deleteFile(PUBLIC_REPO, path, `upload: delete ${objectName}`)
  if (!result.deleted) {
    const error = new Error('not_found')
    error.status = 404
    throw error
  }
  return { ok: true, path, storage: 'repo' }
}

async function parseMarkdownOne(payload) {
  const { markdown } = validateMarkdownPayload(payload)
  const parsed = matter(markdown)
  const data = { ...(parsed.data || {}) }
  if (data.date instanceof Date) data.date = data.date.toISOString().slice(0, 10)
  return {
    ok: true,
    data,
    content: parsed.content.replace(/^\s*\n/, '')
  }
}

export default async function handler(req, res) {
  try {
    if (!isAllowedRequest(req)) return json(res, 403, { error: 'forbidden' })
    if (req.method === 'OPTIONS') return json(res, 204, {})

    const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown')
      .split(',')[0]
      .trim()

    if (req.method === 'GET') {
      if (!rateLimit(`read:${ip}`, 120, 10 * 60 * 1000)) return json(res, 429, { error: 'too_many_requests' })
      return json(res, 200, {
        ok: true,
        configured: hasToken(),
        repos: { public: PUBLIC_REPO, drafts: DRAFTS_REPO, branch: BRANCH }
      })
    }

    if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' })
    if (!rateLimit(`write:${ip}`, 30, 10 * 60 * 1000)) return json(res, 429, { error: 'too_many_requests' })

    const payload = await readJsonBody(req)
    const action = String(payload.action || '')
    if (action === 'upload') {
      if (!rateLimit(`upload:${ip}`, 20, 10 * 60 * 1000)) return json(res, 429, { error: 'too_many_requests' })
      return json(res, 200, await uploadOne(payload))
    }
    if (action === 'listUploads') {
      return json(res, 200, { ok: true, items: await listUploadsOne() })
    }
    if (action === 'deleteUpload') {
      return json(res, 200, await deleteUploadOne(payload))
    }
    if (action === 'parseMarkdown') {
      return json(res, 200, await parseMarkdownOne(payload))
    }
    if (action === 'list') {
      const type = payload.type === 'draft' ? 'draft' : 'post'
      return json(res, 200, { ok: true, type, items: await loadItems(type) })
    }
    if (action === 'get') {
      const type = payload.type === 'draft' ? 'draft' : 'post'
      const slug = validateSlug(payload.slug)
      return json(res, 200, { ok: true, item: await getOne(type, slug) })
    }
    if (action === 'save') {
      const validated = validatePayload(payload)
      return json(res, 200, await saveOne(validated))
    }
    if (action === 'publish') {
      const slug = validateSlug(payload.slug)
      return json(res, 200, await publishOne(slug))
    }
    if (action === 'unpublish') {
      const slug = validateSlug(payload.slug)
      return json(res, 200, await unpublishOne(slug))
    }
    if (action === 'delete') {
      const type = payload.type === 'draft' ? 'draft' : 'post'
      const slug = validateSlug(payload.slug)
      return json(res, 200, await deleteOne(type, slug))
    }

    return json(res, 400, { error: 'unknown_action' })
  } catch (error) {
    console.error('[admin-api]', error?.message || 'unknown_error')
    const mapped = publicError(error)
    return json(res, mapped.status, mapped.body)
  }
}
