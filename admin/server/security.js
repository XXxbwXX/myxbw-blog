const BODY_LIMIT = 256 * 1024
const CONTENT_LIMIT = 200 * 1024
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,80}$/
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const TAG_PATTERN = /^[\p{L}\p{N} _.-]{1,24}$/u

const defaultOrigins = [
  'https://write.myxbw.cn',
  'https://myxbw-blog-admin.vercel.app',
  'http://localhost:5174',
  'http://127.0.0.1:5174'
]

function allowedOrigins() {
  const fromEnv = (process.env.ADMIN_ALLOWED_ORIGINS || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
  return [...new Set([...defaultOrigins, ...fromEnv])]
}

function isPreviewOrigin(origin) {
  return /^https:\/\/myxbw-blog-admin(?:-[a-z0-9]+)+(?:-xbwteam)?\.vercel\.app$/i.test(origin)
}

export function isAllowedOrigin(origin) {
  if (!origin) return false
  if (allowedOrigins().includes(origin)) return true
  return isPreviewOrigin(origin)
}

export function isAllowedRequest(req) {
  const origin = req.headers.origin || ''
  if (origin && !isAllowedOrigin(origin)) return false

  const fetchSite = req.headers['sec-fetch-site']
  if (fetchSite && !['same-origin', 'same-site', 'none'].includes(fetchSite)) return false

  if (req.method === 'OPTIONS') return true
  return req.headers['x-blog-admin'] === 'myxbw-blog-admin'
}

export async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body
  if (typeof req.body === 'string') {
    if (Buffer.byteLength(req.body, 'utf8') > BODY_LIMIT) throw new Error('body_too_large')
    return JSON.parse(req.body)
  }

  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > BODY_LIMIT) throw new Error('body_too_large')
    chunks.push(chunk)
  }
  const text = Buffer.concat(chunks).toString('utf8')
  if (!text) return {}
  return JSON.parse(text)
}

export function validateSlug(value) {
  const slug = String(value || '').trim()
  if (!SLUG_PATTERN.test(slug)) throw new Error('invalid_slug')
  if (slug.includes('..') || slug.includes('/') || slug.includes(String.fromCharCode(92))) throw new Error('invalid_slug')
  return slug
}

export function validatePayload(payload = {}) {
  const type = payload.type === 'draft' ? 'draft' : 'post'
  const slug = validateSlug(payload.slug)
  const title = String(payload.title || '').trim()
  const date = String(payload.date || '').trim()
  const description = String(payload.description || '').trim()
  const body = String(payload.body || '')
  const rawTags = Array.isArray(payload.tags) ? payload.tags : []
  const tags = rawTags.map((tag) => String(tag).trim()).filter(Boolean)

  if (!title || title.length > 120) throw new Error('invalid_title')
  if (!DATE_PATTERN.test(date)) throw new Error('invalid_date')
  if (description.length > 240) throw new Error('invalid_description')
  if (body.length > CONTENT_LIMIT) throw new Error('content_too_large')
  if (tags.length > 10) throw new Error('too_many_tags')
  if (tags.some((tag) => !TAG_PATTERN.test(tag))) throw new Error('invalid_tag')

  let readingTime = Number(payload.readingTime)
  if (!Number.isFinite(readingTime) || readingTime < 1) {
    readingTime = Math.max(1, Math.round(body.length / 500))
  }
  readingTime = Math.min(120, Math.round(readingTime))

  return { type, slug, title, date, description, tags, readingTime, body }
}

export function json(res, status, data) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Robots-Tag', 'noindex, nofollow')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Referrer-Policy', 'no-referrer')
  res.end(JSON.stringify(data))
}

const buckets = new Map()

export function rateLimit(key, limit, windowMs) {
  const now = Date.now()
  const hits = (buckets.get(key) || []).filter((time) => now - time < windowMs)
  if (hits.length >= limit) {
    buckets.set(key, hits)
    return false
  }
  hits.push(now)
  buckets.set(key, hits)
  if (buckets.size > 1000) {
    for (const [bucketKey, times] of buckets) {
      if (!times.length || now - times[times.length - 1] > windowMs) buckets.delete(bucketKey)
    }
  }
  return true
}
