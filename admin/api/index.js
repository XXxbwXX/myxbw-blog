import { createHash } from 'node:crypto'
import matter from 'gray-matter'
import {
  BRANCH,
  DRAFTS_REPO,
  PUBLIC_REPO,
  deleteFile,
  getFile,
  getFileMeta,
  hasToken,
  listDirectory,
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
  validateUploadPayload
} from '../server/security.js'

function publicError(error) {
  const message = String(error?.message || '')
  const code = String(error?.code || '')
  if (message === 'token_missing' || code === 'token_missing') return { status: 503, body: { error: 'token_missing' } }
  if (message === 'body_too_large') return { status: 413, body: { error: 'body_too_large' } }
  if (message === 'file_too_large') return { status: 413, body: { error: 'file_too_large' } }
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

async function deleteOne(type, slug) {
  if (type !== 'draft') {
    const error = new Error('invalid_type')
    error.status = 400
    throw error
  }
  await deleteFile(DRAFTS_REPO, `drafts/${slug}.md`, `draft: delete ${slug}`)
  return { ok: true, slug }
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
  const objectPath = `docs/public/uploads/${year}/${month}/${safeName}`
  const existing = await getFileMeta(PUBLIC_REPO, objectPath)
  if (!existing) {
    await putBinaryFile(PUBLIC_REPO, objectPath, file.buffer.toString('base64'), `upload: ${safeName}`)
  }
  return {
    ok: true,
    kind: file.kind,
    name: safeName,
    url: `/uploads/${year}/${month}/${encodeURIComponent(safeName)}`,
    path: objectPath,
    size: file.size
  }
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
